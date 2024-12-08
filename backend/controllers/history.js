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
  