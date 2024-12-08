const jwt = require("jsonwebtoken");
const prisma = require("../db")
const log = require("../controllers/history")

// Create a new slot
exports.createSlot = async (req, res) => {
    try {
      const { title, description, startTime, endTime, startDate, endDate, userId } = req.body;
  
      // Convert string dates to Date objects
      const start = new Date(startTime);
      const end = new Date(endTime);
      const startD = new Date(startDate);
      const endD = new Date(endDate);
  
      // Check if the user already has a slot in the specified time range
      const existingSlot = await prisma.slot.findFirst({
        where: {
          userId,
          active: true,
          OR: [
            {
              startTime: {
                lt: end, // Existing slot starts before new slot ends
              },
              endTime: {
                gt: start, // Existing slot ends after new slot starts
              },
            },
            {
              startDate: {
                lt: endD, // Existing slot starts before new slot end date
              },
              endDate: {
                gt: startD, // Existing slot ends after new slot start date
              },
            },
          ],
        },
      });
  
      if (existingSlot) {
        return res.status(400).json({
          message: "User already has a slot in this time range. Please choose another time.",
        });
      }

      const user = await prisma.user.findUnique({
        where: {
          id: parseInt(userId), // Find the user by id
        },
      });
      
      //const user = meeting?.host;
  
      // Create a new slot
      const newSlot = await prisma.slot.create({
        data: {
          title,
          description,
          startTime: start,
          endTime: end,
          startDate: startD,
          endDate: endD,
          userId,
          active: true,
        },
      });

      // Log the operation
      const details = `User ${user.name} creates a new slot.`;
      await log.logOperation("Create", "Slot", details);  // Log the update operation
  
      res.status(201).json({ message: "Slot created successfully.", slot: newSlot });
    } catch (error) {
      res.status(500).json({ message: "Error creating slot.", error: error.message });
    }
  };
  

// Get all slots
exports.getAllSlots = async (req, res) => {
    try {
      const slots = await prisma.slot.findMany({
        include: {
            user: true,
        }
      });
      res.status(200).json(slots);
    } catch (error) {
      res.status(500).json({ message: "Error fetching slots.", error: error.message });
    }
  };

// Get a slot by ID
exports.getSlotById = async (req, res) => {
    try {
      const { id } = req.params;
  
      const slot = await prisma.slot.findUnique({
        where: { id: parseInt(id) },
            include: {
                user: true,
            }
          
      });
  
      if (!slot) {
        return res.status(404).json({ message: "Slot not found." });
      }
  
      res.status(200).json(slot);
    } catch (error) {
      res.status(500).json({ message: "Error fetching slot.", error: error.message });
    }
  };

// Get all slots by user ID
exports.getSlotsByUser = async (req, res) => {
    try {
      const { id } = req.params;
  
      // Fetch all slots for the user
      const slots = await prisma.slot.findMany({
        where: { userId: parseInt(id) },
      });
  
      res.status(200).json(slots);
    } catch (error) {
      res.status(500).json({ message: "Error fetching slots.", error: error.message });
    }
  };
  

// Update a slot by ID
exports.updateSlot = async (req, res) => {
    try {
      const { id, title, description, startTime, endTime, startDate, endDate, userId, active } = req.body;
  
      // Convert string dates to Date objects
      const start = new Date(startTime);
      const end = new Date(endTime);
      const startD = new Date(startDate);
      const endD = new Date(endDate);
  
      // Check if the updated slot's time range conflicts with other active slots for the user
      const existingSlot = await prisma.slot.findFirst({
        where: {
          userId,
          active: true,
          NOT: {
            id: id, // Exclude the current slot from the check
          },
          OR: [
            {
              startTime: {
                lt: end, // Existing slot starts before updated slot ends
              },
              endTime: {
                gt: start, // Existing slot ends after updated slot starts
              },
            },
            {
              startDate: {
                lt: endD, // Existing slot starts before updated slot end date
              },
              endDate: {
                gt: startD, // Existing slot ends after updated slot start date
              },
            },
          ],
        },
      });
  
      if (existingSlot) {
        return res.status(400).json({
          message: "The updated slot time conflicts with another active slot. Please choose a different time.",
        });
      }

      const user = await prisma.user.findUnique({
        where: {
          id: parseInt(userId), // Find the user by id
        },
      });
  
      // Update the slot if no conflict is found
      const updatedSlot = await prisma.slot.update({
        where: { id },
        data: {
          title,
          description,
          startTime: start,
          endTime: end,
          startDate: startD,
          endDate: endD,
          userId,
          active
        },
      });

      // Log the operation
      const details = `User ${user.name} updates a slot.`;
      await log.logOperation("Update", "Slot", details);  // Log the update operation
  
      res.status(200).json({ message: "Slot updated successfully.", slot: updatedSlot });
    } catch (error) {
      res.status(500).json({ message: "Error updating slot.", error: error.message });
    }
  };


  exports.getSlotsForDates = async (req, res) => {
    try {
      const { date, userId } = req.params;
  
      // Calculate start and end dates for the 7-day range
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 6); // 7-day range including the start date
  
      //console.log("Start Date:", startDate);
      //console.log("End Date:", endDate);
  
      // Fetch slots within the 7-day range
      const slots = await prisma.slot.findMany({
        where: {
          OR: [
            {
              startDate: {
                lte: endDate, // Start date is before or equal to the end of the range
              },
              endDate: {
                gte: startDate, // End date is after or equal to the start of the range
              },
            },
          ],
          ...(userId && { userId: parseInt(userId) }), // Filter by userId if provided
        },
      });
  
      //console.log("Slots fetched:", slots);
  
      // Create an array of all dates between the start and end date
      const dates = [];
      for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
        dates.push(new Date(currentDate).toISOString().split("T")[0]); // Format as YYYY-MM-DD
      }
  
      // Group slots by each date
      const groupedSlots = dates.reduce((result, currentDate) => {
        result[currentDate] = slots.filter(slot => {
          const slotStartDate = new Date(slot.startDate).toISOString().split("T")[0];
          const slotEndDate = new Date(slot.endDate).toISOString().split("T")[0];
          return currentDate >= slotStartDate && currentDate <= slotEndDate;
        });
        return result;
      }, {});
  
      res.status(200).json({ message: "Slots fetched successfully.", groupedSlots });
    } catch (error) {
      console.error("Error fetching slots:", error);
      res.status(500).json({ message: "Error fetching slots.", error: error.message });
    }
  };
  
  
  