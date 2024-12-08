const prisma = require("../db")

// Function to save the operation details to History table
exports.logOperation = async (operation, tableName, details) => {
    try {
      await prisma.history.create({
        data: {
          operation: operation,  // Type of operation (e.g., 'INSERT', 'UPDATE', 'DELETE')
          tableName: tableName,   // Name of the table being modified (e.g., 'User', 'Meeting')
          details: details,       // Short description of the operation (e.g., 'User X updated their profile')
        },
      });
      console.log(`Operation logged: ${operation} on ${tableName}`);
    } catch (error) {
      console.error("Error logging operation:", error.message);
    }
  };
  

  exports.getAllHistory = async (req, res) => {
    try {
      // Fetch all history data
      const historyData = await prisma.history.findMany({
        orderBy: {
          createdAt: 'desc', // Optional: sorts the results by the creation date (newest first)
        },
      });
  
      res.status(200).json({
        message: "History data fetched successfully.",
        history: historyData,
      });
    } catch (error) {
      res.status(500).json({
        message: "Error fetching history data.",
        error: error.message,
      });
    }
  };

  exports.getUserNotifications = async (req, res) => {
    try {
      const { userId } = req.params;
  
      // Fetch notifications for the user
      const notifications = await prisma.notification.findMany({
        where: {
          userId: parseInt(userId),
        },
        orderBy: {
          createdAt: "desc", // Sort by most recent first
        },
      });
  
      if (!notifications.length) {
        return res.status(404).json({
          message: `No notifications found for user with ID ${userId}.`,
        });
      }
  
      res.status(200).json({
        message: "Notifications fetched successfully.",
        notifications,
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({
        message: "Error fetching notifications.",
        error: error.message,
      });
    }
  };
  
  