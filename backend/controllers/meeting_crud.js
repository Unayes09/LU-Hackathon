const prisma = require("../db")
const log = require("../controllers/history")

// Create a new meeting
// Request Body Parameters:
// - description (String): Description of the meeting
// - date (DateTime): Date and time of the meeting
// - slotId (Int): ID of the associated slot
// - hostId (Int): ID of the meeting host (user)
// - guests (Array of Int): List of guest user IDs
exports.createMeeting = async (req, res) => {
    try {
      const { description, date, slotId, hostId, guestIds } = req.body;
  
      // Check if a similar meeting exists
      const existingMeeting = await prisma.meeting.findFirst({
        where: { description, date, slotId, hostId },
      });

      const user = await prisma.user.findUnique({
        where: { id: hostId },
      });
  
      if (existingMeeting) {
        return res
          .status(400)
          .json({ message: "Meeting with similar details already exists." });
      }
  
      // Create the meeting
      const meeting = await prisma.meeting.create({
        data: {
          description,
          date: new Date(date),
          slotId,
          hostId,
          status: 1, // Default status: pending
        },
      });
  
      // Add guests to the meeting using async loop
      await Promise.all(
        guestIds.map(async (guestId) => {
          await prisma.meetingClient.create({
            data: {
              meetingId: meeting.id,
              guestId,
            },
          });
        })
      );
      
  
      // Log the operation
      const details = `User ${user.name} creates a new meeting.`;
      await log.logOperation("Create", "Meeting", details);  // Log the update operation

      res
        .status(201)
        .json({ message: "Meeting created successfully.", meeting });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error creating meeting.", error: error.message });
    }
  };
  
  

// Get all meetings
// No request body
exports.getAllMeetings = async (req, res) => {
  try {
    const meetings = await prisma.meeting.findMany({
      include: {
        meetingClients: true, // Include meeting guests
      },
    });

    res.status(200).json(meetings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching meetings.", error: error.message });
  }
};

// Get a meeting by ID
// Request Body Parameters:
// - id (Int): ID of the meeting to fetch
exports.getMeetingById = async (req, res) => {
  try {
    const { id } = req.params;

    const meeting = await prisma.meeting.findUnique({
      where: { id: parseInt(id) },
      include: {
        meetingClients: true, // Include meeting guests
      },
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found." });
    }

    res.status(200).json(meeting);
  } catch (error) {
    res.status(500).json({ message: "Error fetching meeting.", error: error.message });
  }
};

// Delete a meeting
// Request Body Parameters:
// - id (Int): ID of the meeting to delete
exports.deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    const meeting = await prisma.meeting.findUnique({
        where: { id: parseInt(id) },
        include: { host: true }, // This will include the user (host) data
      });
      
    const host = meeting?.host; // Extract the host info

    // Delete meeting guests first
    await prisma.meetingClient.deleteMany({
      where: { meetingId: parseInt(id) },
    });

    // Delete the meeting
    await prisma.meeting.delete({
      where: { id: parseInt(id) },
    });

    // Log the operation
    const details = `User ${host.name} deletes a meeting.`;
    await log.logOperation("Delete", "Meeting", details);  // Log the update operation

    res.status(200).json({ message: "Meeting and guests deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error deleting meeting.", error: error.message });
  }
};

// Get all meetings of a user by hostId
// Request Body Parameters:
// - hostId (Int): ID of the user hosting the meetings
exports.getMeetingsByHost = async (req, res) => {
  try {
    const { hostId } = req.params;

    const meetings = await prisma.meeting.findMany({
      where: { hostId: parseInt(hostId) },
      include: {
        meetingClients: true, // Include meeting guests
        slot: true, // Include slot details
      },
    });

    res.status(200).json(meetings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching meetings by host.", error: error.message });
  }
};


exports.getMeetingsForDates = async (req, res) => {
  try {
    const { date, userId } = req.params;
    const startDate = new Date(date);

    // Create an array of the next 5 consecutive dates
    const dates = Array.from({ length: 7 }, (_, i) => {
      const newDate = new Date(startDate);
      newDate.setDate(startDate.getDate() + i);
      return newDate.toISOString().split("T")[0]; // Format as YYYY-MM-DD
    });

    // Fetch meetings for the 5 days and filter by userId
    const meetings = await prisma.meeting.findMany({
      where: {
        date: {
          gte: new Date(dates[0]), // First day
          lt: new Date(dates[6]), // Up to the fifth day
        },
        hostId: parseInt(userId), // Match the userId
      },
      include: {
        slot: true, // Include associated slot information
        meetingClients: true, // Include meeting clients
      },
    });

    // Group meetings by each day
    const groupedMeetings = dates.reduce((result, currentDate) => {
      result[currentDate] = meetings.filter(meeting =>
        new Date(meeting.date).toISOString().split("T")[0] === currentDate
      );
      return result;
    }, {});

    res.status(200).json({ message: "Meetings fetched successfully.", groupedMeetings });
  } catch (error) {
    res.status(500).json({ message: "Error fetching meetings.", error: error.message });
  }
};

exports.changeMeetingStatus = async (req, res) => {
    try {
      const { meetingId, status } = req.params;
      const changing_status = parseInt(status);
  
      // Validate status
      if (![0, 1, 2].includes(changing_status)) {
        return res.status(400).json({
          message: "Invalid status. Valid values are: 0 (Cancelled), 1 (Pending), 2 (Completed).",
        });
      }

      const meeting = await prisma.meeting.findUnique({
        where: { id: parseInt(meetingId) },
        include: { host: true }, // This will include the user (host) data
      });
      
      const host = meeting?.host; // Extract the host info
  
      // Update the meeting status
      const updatedMeeting = await prisma.meeting.update({
        where: {
          id: parseInt(meetingId),
        },
        data: {
          status: changing_status, // Corrected field name
        },
      });

      // Log the operation
      const details = `User ${host.name} update meeting status.`;
      await log.logOperation("Update", "Meeting", details);  // Log the update operation
  
      res.status(200).json({
        message: "Meeting status updated successfully.",
        meeting: updatedMeeting,
      });
    } catch (error) {
      res.status(500).json({ message: "Error updating meeting status.", error: error.message });
    }
  };

  exports.getMeetingsBySlotId = async (req, res) => {
    try {
      const { slotId } = req.params;
  
      // Ensure slotId is an integer
      const slotIdInt = parseInt(slotId);
  
      if (isNaN(slotIdInt)) {
        return res.status(400).json({
          message: "Invalid slotId. It must be a valid number.",
        });
      }
  
      // Fetch meetings associated with the given slotId
      const meetings = await prisma.meeting.findMany({
        where: {
          slotId: slotIdInt,
        },
        include: {
          slot: true, // You can include related data, like slot details
          host: true, // Include host details if needed
        },
      });
  
      if (meetings.length === 0) {
        return res.status(404).json({
          message: `No meetings found for slotId ${slotIdInt}.`,
        });
      }
  
      res.status(200).json({
        message: "Meetings fetched successfully.",
        meetings,
      });
    } catch (error) {
      res.status(500).json({
        message: "Error fetching meetings.",
        error: error.message,
      });
    }
  };
  