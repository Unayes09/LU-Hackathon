const { OpenAI } = require('openai');
const fs = require('fs-extra');
const sharp = require('sharp');
const os = require('os');
const path = require('path');
const { writeFileSync } = require("fs");
const cloudinary = require("cloudinary").v2;
const axios = require("axios");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Initialize OpenAI API with the API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure this is set in your environment variables
});

const openaiMiddleware = {
  /**
   * Analyze an image using OpenAI's models by providing the image file path.
   * @param {string} imagePath - Path to the image file to analyze.
   * @returns {Promise<string>} - The description of the image.
   */
  analyzeImage: async (imageUrl) => {
    try {
      
      // Set the prompt for image analysis
      const prompt = `Analyze the following image and describe it in detail.`;

      // Send the request to OpenAI API for image analysis
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    "url": imageUrl,
                  },
                },
              ],
            },
          ],
      });

      // Return the description of the image
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error analyzing image:', error);
      throw new Error('Failed to analyze image');
    }
  },

  /**
   * Generate an image based on a given prompt.
   * @param {string} prompt - The prompt describing the image to generate.
   * @returns {Promise<string>} - The URL of the generated image.
   */
  generateImage: async (prompt) => {
    try {
      // Create an image generation request to the OpenAI API
      const response = await openai.images.generate({
        model: "dall-e-2",
        prompt: prompt,
        n: 1,
        size: "512x512",
      });
  
      // Extract the URL of the generated image
      const imageUrl = response.data[0].url;
  
      // Download the image to a temporary file
      const tempFilePath = path.join(__dirname, "generated_image.png");
      const writer = fs.createWriteStream(tempFilePath);
      const imageResponse = await axios({
        url: imageUrl,
        method: "GET",
        responseType: "stream",
      });
      imageResponse.data.pipe(writer);
  
      // Wait for the file to finish writing
      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
  
      // Upload the image to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
        resource_type: "image", // Specify the resource type as 'image'
      });
  
      // Delete the local file after uploading
      fs.unlinkSync(tempFilePath);
  
      // Return the Cloudinary URL
      return uploadResult.secure_url;
    } catch (error) {
      console.error("Error generating image:", error);
      throw new Error("Failed to generate image");
    }
  },

  /**
   * Format input data into JSON using OpenAI's API.
   * @param {string} input - The raw text input to format.
   * @returns {Promise<object>} - The formatted JSON object.
   */
  generateJSON: async (inputJson) => {
    try {
      // Extract relevant fields from the input JSON
      const { user, meetings } = inputJson.jsonData;
  
      // Generate the prompt dynamically using input data
      const prompt = `
  You are provided with details about a host and their associated meetings. 

  Host profession: "${user.profession}"

  Analyze the relevance of each meeting for the host based on its description. Relevance should be a score out of 10 that represents how suitable the meeting is for the host's profession. 

  Meetings to analyze:
  ${meetings.map((meeting) => `ID: ${meeting.id}, Description: "${meeting.description}"`).join('\n')}

  Your task:
  - Assign a relevance score (0-10) to each meeting.
  - Output only a JSON array in the following format from most to least relevance:
    [
      { "id": number, "relevance": number },
      ...
    ]

  Strictly adhere to this format and do not include any additional text, explanations, or commentary outside the JSON output.
`;

  
      // Call OpenAI API for generating JSON response
        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200, // Limit token usage
        });
        
        // Extract the content of the response
        const fullContent = response.choices[0].message.content;
        
        // Find the JSON string between [ and ]
        const jsonStart = fullContent.indexOf('[');
        const jsonEnd = fullContent.lastIndexOf(']') + 1; // Include the closing bracket
        
        if (jsonStart !== -1 && jsonEnd !== -1) {
            const jsonString = fullContent.slice(jsonStart, jsonEnd); // Extract JSON substring
            try {
            // Parse and return the JSON object
            return JSON.parse(jsonString);
            } catch (error) {
            throw new Error('Failed to parse JSON: ' + error.message);
            }
        } else {
            throw new Error('No JSON content found in the response');
        }
  
    } catch (error) {
      console.error('Error generating JSON:', error);
  
      // Return a fallback for invalid JSON formatting or unexpected errors
      if (error instanceof SyntaxError) {
        throw new Error('Failed to parse JSON response');
      }
      throw new Error('Failed to generate JSON');
    }
  },

  generateJSONGuest: async (inputJson) => {
    try {
      // Extract fields from the input JSON
      const { text, users } = inputJson.jsonData;
  
      // Generate the dynamic prompt using input data
      const prompt = `

    The following text is about to find someone who is relevent to my database. May be the text is not fully relevent but you have 
    to try your best to match relevent profession of my databases user profession. Also you can see the user's all slot and their slots to 
    find a perfect match. You should give all of the relevant slot from first to last whether there is a match or not.
  You are tasked with analyzing meeting slots for relevance based on a guest's requirements. Always give all slot where user profession can match in list. In most time, try to find some slot.

  Guest's requirements:
  "${text}"
  
  Hosts and their available slots:
  ${users.map((user) => `
    {
      "hostId": ${user.id},
      "name": "${user.name}",
      "profession": "${user.profession}",
      "slots": [
        ${user.slots.map(slot => `
          {
            "slotId": ${slot.id},
            "title": "${slot.title}",
            "description": "${slot.description}",
            "startTime": "${slot.startTime}",
            "endTime": "${slot.endTime}"
          }
        `).join(',')}
      ]
    }
  `).join(',')}
  
  Based on the requirements, analyze the relevance of each slot:
  1. Relevance is determined by how well the slot's description matches the guest's requirements.
  2. Relevance is also influenced by how well the host's profession aligns with the guest's requirements.

  Your task:
  Return **only** a JSON array for suggestion of taking best slot one by one, always give full list of slot using the following structure:
  [
    { "slotId": number, "hostId": number },
    ...
  ]
  
  Strictly follow this format and do not include any additional text or explanation.
`;

  
      // Call OpenAI API to process the prompt and generate a response
        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500, // Limit token usage
        });
        
        try {
            // Extract the content of the response
            const fullContent = response.choices[0].message.content;
        
            // Find the JSON string between [ and ]
            const jsonStart = fullContent.indexOf('[');
            const jsonEnd = fullContent.lastIndexOf(']') + 1; // Include the closing bracket
        
            if (jsonStart !== -1 && jsonEnd !== -1) {
            // Extract JSON substring
            const jsonString = fullContent.slice(jsonStart, jsonEnd);
            //console.log(jsonString); // Log the JSON string for debugging
            return JSON.parse(jsonString); // Parse and return the JSON object
            } else {
            throw new Error('No JSON content found in the response');
            }
        } catch (error) {
            console.error('Error processing response:', error.message);
            throw error;
        }
  
    } catch (error) {
      console.error('Error generating JSON:', error);
  
      // Handle errors, including invalid JSON or unexpected issues
      if (error instanceof SyntaxError) {
        throw new Error('Failed to parse JSON response from OpenAI');
      }
      throw new Error('Failed to generate JSON');
    }
  },
  
  

  /**
   * Generate voice-ready text based on a given input.
   * @param {string} text - The text to prepare for voice synthesis.
   * @returns {Promise<string>} - The prepared text for voice generation.
   */
  generateVoiceText: async (text) => {
    try {
      // Set the prompt to convert text into suitable transcription for voice synthesis
      const prompt = `Convert the following text into a suitable transcription or text prompt for voice synthesis:\n\n${text}`;

      // Create a chat completion request to OpenAI API for generating voice text
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
      });

      // Return the generated voice-ready text
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error generating voice text:', error);
      throw new Error('Failed to generate voice text');
    }
  },

  generateVoice: async(prompt)=> {
    try {
      
      // Generate an audio response to the given prompt
      const response = await openai.chat.completions.create({
        model: "gpt-4o-audio-preview",
        modalities: ["text", "audio"],
        audio: { voice: "alloy", format: "wav" },
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      // Write audio data to a temporary file
      const tempFilePath = path.join(__dirname, "voice.wav");
      fs.writeFileSync(
        tempFilePath,
        Buffer.from(response.choices[0].message.audio.data, "base64")
      );

      // Upload the file to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
        resource_type: "video", // For audio files, Cloudinary uses 'video' resource type
      });

      // Delete the local file after uploading
      fs.unlinkSync(tempFilePath);

      // Return the Cloudinary URL
      return uploadResult.secure_url;

    } catch (error) {
      console.error('Error generating voice:', error);
      throw new Error('Failed to generate voice');
    }
  },
};

module.exports = openaiMiddleware;
