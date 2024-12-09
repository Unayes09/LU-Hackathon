const prisma = require("../db")
const nodemailer = require("nodemailer");
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
        where: { description, date: new Date(date), slotId, hostId },
      });
  
      if (existingMeeting) {
        return res
          .status(400)
          .json({ message: "Meeting with similar details already exists." });
      }
  
      // Fetch the host details
      const host = await prisma.user.findUnique({
        where: { id: hostId },
      });
  
      if (!host) {
        return res
          .status(404)
          .json({ message: `Host with ID ${hostId} not found.` });
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
  
      // Fetch guest details by guestIds
      const guestDetails = await prisma.user.findMany({
        where: {
          id: { in: guestIds },
        },
        select: {
          name: true,
          email: true,
        },
      });
  
      // Add guests to the meeting
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
  
      // Compose guest names and emails for the email body
      const guestNames = guestDetails.map((guest) => guest.name).join(", ");
      const guestEmails = guestDetails.map((guest) => guest.email).join(", ");
  
      // Send email to the host
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SMTP_EMAIL, // Your email
          pass: process.env.SMTP_PASS, // Your email password or app password
        },
      });
  
      const mailOptions = {
        from: "Shakkhat@gmail.com", // Sender email address
        to: host.email, // Host's email address
        subject: "Meeting Invitation",
        text: `
  Dear ${host.name},
  
  You have been invited to host a meeting with the following details:
  
  Description: ${description}
  Date: ${date}
  Slot ID: ${slotId}
  
  Guests: ${guestNames} (${guestEmails})
  
  Best regards,
  Meeting Scheduler Team
        `,
      };
  
      await transporter.sendMail(mailOptions);
  
      // Create a notification for the host
      const notification = await prisma.notification.create({
        data: {
          title: "New Meeting For You",
          description: `You are invited to host a meeting with guests: ${guestNames}.`,
          userId: hostId,
        },
      });
  
      // Log the operation
      const details = `User ${guestNames} creates a new meeting with host: ${host.name}.`;
      await log.logOperation("Create", "Meeting", details);
  
      res.status(201).json({
        message: "Meeting created successfully, email sent, and notification saved.",
        meeting,
        notification,
      });
    } catch (error) {
      console.error("Error creating meeting:", error);
      res.status(500).json({ message: "Error creating meeting.", error: error.message });
    }
  };
  
  

// Get all meetings
// No request body
exports.getAllMeetings = async (req, res) => {
  try {
    const meetings = await prisma.meeting.findMany({
      include: {
        meetingClients: true, // Include meeting guests
        host: true,
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


exports.getMeetingsForToday = async (req, res) => {
    try {
      // Retrieve the logged-in user's ID from the request (assuming userId is available in req.user or req.body)
      const { userId } = req.params;
  
      if (!userId) {
        return res.status(401).json({
          message: "Unauthorized: User ID is required to fetch meetings.",
        });
      }
  
      // Get the current date
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to the start of the day

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // Set to the start of the next day

    // Fetch meetings for the current day where the date matches
    const meetings = await prisma.meeting.findMany({
      where: {
        AND: [
          {
            date: {
              gte: today,   // Greater than or equal to the start of today
              lt: tomorrow, // Less than the start of tomorrow
            },
          },
          {
            hostId: parseInt(userId), // Match the logged-in user's ID
          },
        ],
      },
      include: {
        slot: true, // Include related slot details
        host: true, // Include related host details if needed
      }
    });
  
      if (meetings.length === 0) {
        return res.status(404).json({
          message: "No meetings found for today.",
        });
      }
  
      res.status(200).json({
        message: "Meetings fetched successfully.",
        meetings,
      });
    } catch (error) {
      console.error("Error fetching meetings:", error);
      res.status(500).json({
        message: "Error fetching meetings.",
        error: error.message,
      });
    }
  };
  

  exports.changeMeetingStatus = async (req, res) => {
    try {
      const { meetingId, status } = req.params;
      const { start_time, end_time } = req.body;
      const changing_status = parseInt(status);
  
      // Validate status
      if (![0, 1, 2].includes(changing_status)) {
        return res.status(400).json({
          message:
            "Invalid status. Valid values are: 0 (Cancelled), 1 (Pending), 2 (Completed).",
        });
      }
  
      // Fetch meeting details with host and guests
      const meeting = await prisma.meeting.findUnique({
        where: { id: parseInt(meetingId) },
        include: {
          host: true, // Include the host details
          meetingClients: {
            include: {
              guest: true, // Include the guest details
            },
          },
        },
      });
  
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found." });
      }
  
      const host = meeting.host; // Host details
      const guests = meeting.meetingClients.map((mc) => mc.guest); // Guest details
  
      // Update the meeting status
      const updatedMeeting = await prisma.meeting.update({
        where: {
          id: parseInt(meetingId),
        },
        data: {
          start_time: start_time,
          end_time: end_time,
          status: changing_status,
        },
      });
  
      // Compose email content
      const statusMessages = {
        0: "Cancelled",
        1: "Pending",
        2: "Accepted",
      };
      const statusText = statusMessages[changing_status];
      const subject = `Meeting Status Updated to ${statusText}`;
      const emailBody = `
  Dear Guest,
  
  The meeting "${meeting.description}" scheduled on ${meeting.date} has been updated to the following status: ${statusText}.
  
  Best regards,
  Meeting Scheduler Team
      `;
  
      // Send email to all guests
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASS,
        },
      });
  
      await Promise.all(
        guests.map(async (guest) => {
          const mailOptions = {
            from: "Shakkhat@gmail.com",
            to: guest.email,
            subject,
            text: emailBody,
          };
          await transporter.sendMail(mailOptions);
        })
      );
  
      // Save notifications for all guests
      await Promise.all(
        guests.map(async (guest) => {
          await prisma.notification.create({
            data: {
              title: `Meeting Status Updated`,
              description: `The meeting "${meeting.description}" is now ${statusText}.`,
              userId: guest.id,
            },
          });
        })
      );
  
      // Log the operation
      const details = `User ${host.name} updated meeting status to ${statusText}.`;
      await log.logOperation("Update", "Meeting", details);
  
      res.status(200).json({
        message: "Meeting status updated successfully, emails sent, and notifications created.",
        meeting: updatedMeeting,
      });
    } catch (error) {
      console.error("Error updating meeting status:", error);
      res.status(500).json({
        message: "Error updating meeting status.",
        error: error.message,
      });
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
  