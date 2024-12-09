const openaiMiddleware = require('../middlewars/openaiMiddlewar');

exports.generateJSON = async (req, res) => {
    const { text } = req.body;
  
    try {
      if (!text) {
        return res.status(400).json({ error: 'Text input is required' }); // 400 Bad Request
      }
      const jsonData = await openaiMiddleware.generateJSON(text);
      res.status(200).json({ jsonData });
    } catch (error) {
      console.error('Error generating JSON:', error.message);
      res.status(500).json({ error: 'Failed to generate JSON' });
    }
  };

  exports.generateJSONwithSlot = async (req, res) => {
    const { slotId } = req.params; // Get slotId from route params
  
    try {
      // Validate slotId
      if (!slotId) {
        return res.status(400).json({ error: "Slot ID is required" }); // 400 Bad Request
      }
  
      // Fetch the slot with user details
      const slot = await prisma.slot.findUnique({
        where: { id: parseInt(slotId) },
        include: {
          user: true, // Include user details
          meetings: true, // Include associated meetings
        },
      });
  
      if (!slot) {
        return res.status(404).json({ error: `Slot with ID ${slotId} not found` }); // 404 Not Found
      }
  
      // Extract user details and meetings
      const user = slot.user;
      const meetings = slot.meetings;
  
      // Build a human-readable text
      let meetingDetails = `Slot Details:\n\nTitle: ${slot.title}\nDescription: ${slot.description}\nStart Time: ${slot.startTime}\nEnd Time: ${slot.endTime}\n\n`;
      meetingDetails += `User Details:\n\nName: ${user.name}\nEmail: ${user.email}\nProfession: ${user.profession}\n\n`;
      meetingDetails += `Associated Meetings:\n\n`;
  
      if (meetings.length === 0) {
        meetingDetails += "No meetings associated with this slot.";
      } else {
        meetings.forEach((meeting, index) => {
          meetingDetails += `Meeting ${index + 1}:\nDescription: ${meeting.description}\nDate: ${meeting.date}\nStatus: ${
            meeting.status === 0
              ? "Cancelled"
              : meeting.status === 1
              ? "Pending"
              : "Completed"
          }\n\n`;
        });
      }
  
      // Convert the details into JSON format for response
      const jsonData = {
        slot: {
          id: slot.id,
          title: slot.title,
          description: slot.description,
          startTime: slot.startTime,
          endTime: slot.endTime,
          userId: slot.userId,
        },
        user: {
          name: user.name,
          email: user.email,
          profession: user.profession,
        },
        meetings: meetings.map((meeting) => ({
          id: meeting.id,
          description: meeting.description,
          date: meeting.date,
          status: meeting.status,
        })),
        //readableText: meetingDetails,
      };
      const priority = await openaiMiddleware.generateJSON({jsonData});
      res.status(200).json(priority);
    } catch (error) {
      console.error("Error generating JSON:", error.message);
      res.status(500).json({ error: "Failed to generate JSON" }); // 500 Internal Server Error
    }
  };
  
  exports.generateJSONForGuest = async (req, res) => {
    const { userId, text } = req.body; // Get userId and text from the request body
  
    try {
      // Validate input
      if (!userId || !text) {
        return res.status(400).json({ error: "User ID and text are required" }); // 400 Bad Request
      }
  
      // Fetch all users excluding the given user ID and their active slots
      const users = await prisma.user.findMany({
        where: {
          id: { not: parseInt(userId) }, // Exclude the given user ID
          slots: {
            some: { active: true }, // Filter users with at least one active slot
          },
        },
        include: {
          slots: {
            where: { active: true }, // Include only active slots
          },
        },
      });
  
      if (users.length === 0) {
        return res.status(404).json({ error: "No other users with active slots found" }); // 404 Not Found
      }
  
      // Construct JSON data to send to the generateJSON function
      const jsonData = {
        text, // The input text from the user
        users: users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          profession: user.profession,
          slots: user.slots.map((slot) => ({
            id: slot.id,
            title: slot.title,
            description: slot.description,
            startTime: slot.startTime,
            endTime: slot.endTime,
            startDate: slot.startDate,
            endDate: slot.endDate,
          })),
        })),
      };
  
      // Call generateJSON middleware to process the data
      const priority = await openaiMiddleware.generateJSONGuest({ jsonData });
  
      // Return the processed data as the response
      res.status(200).json(priority);
    } catch (error) {
      console.error("Error generating JSON for guest:", error.message);
      res.status(500).json({ error: "Failed to generate JSON for guest" }); // 500 Internal Server Error
    }
  };
  