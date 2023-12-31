const express = require("express");
const { check, validationResult } = require("express-validator");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
require("dotenv").config();

// Replace 'YOUR_OPENAI_API_KEY' with your actual OpenAI API key
const apiKey = process.env.APIkey; // "239482"
const app = express();
const port = 3000;
app.use(express.json());
const swaggerOptions = require("./swaggerOptions");
const unsplashApiKey = "your_unsplash_api_key"; // Replace with your Unsplash API key

// API Documentation using swagger-jsdoc

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
const fetchFoodImage = async (foodItem) => {
  const unsplashUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
    foodItem
  )}&client_id=${unsplashApiKey}&per_page=1`;
  try {
    const response = await axios.get(unsplashUrl);
    if (response.data.results.length > 0) {
      return response.data.results[0].urls.regular;
    }
    return null;
  } catch (error) {
    console.error("Error fetching food image:", error.message);
    return null;
  }
};

const validateOptions = () => {
  return [
    check("user").notEmpty().withMessage("User field is required."),
    check("dietaryPreference")
      .notEmpty()
      .withMessage("Dietary preference field is required.")
      .isString()
      .withMessage("Dietary preference must be a string."),
    check("healthGoal")
      .notEmpty()
      .withMessage("Health goal field is required.")
      .isString()
      .withMessage("Health goal must be a string."),
    check("numDays")
      .notEmpty()
      .withMessage("Number of days field is required.")
      .isInt({ min: 1 })
      .withMessage("Number of days must be a positive integer."),
    check("allergies").isArray().withMessage("Allergies must be an array."),
    check("budgetConstraint")
      .optional()
      .isNumeric()
      .withMessage("Budget constraint must be a number."),
  ];
};

async function askGPT(prompt) {
  const endpoint = "https://api.openai.com/v1/chat/completions";
  const data = {
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    timeout: 0,
    body: JSON.stringify(data),
  };

  try {
    const response = await fetch(endpoint, options);
    const jsonResponse = await response.json();
    const content = jsonResponse.choices[0].message.content;
    return content;
  } catch (e) {
    console.log("Error fetching API response: " + e.message);
    return null;
  }
}

const extractDaysFromDietPlan = (generatedDiet) => {
  const days = [];
  const dayRegex = /Day (\d+):/g;
  let match;

  while ((match = dayRegex.exec(generatedDiet)) !== null) {
    const dayNumber = match[1];
    const dayStartIndex = match.index;
    let dayEndIndex;

    // Find the end of the day section or the start of the next day section
    const nextDayMatch = dayRegex.exec(generatedDiet);
    if (nextDayMatch !== null) {
      dayEndIndex = nextDayMatch.index;
    } else {
      dayEndIndex = generatedDiet.length;
    }

    // Extract the day section from the generated diet
    const daySection = generatedDiet.slice(dayStartIndex, dayEndIndex).trim();
    days.push({ day: dayNumber, diet: daySection });
  }

  return days;
};
// Function to generate the short overview of the diet plan
const generateDailyDiet = async (options, day) => {
  const { healthGoal, dietaryPreference, numDays } = options;
  let prompt = `Create a diet plan for a ${healthGoal} individual with ${dietaryPreference} preferences for ${day} days. Now provide and send only  the diet for day ${day}.It should be only uzbek cousin`;

  // Send the prompt to OpenAI API for generating the daily diet overview
  try {
    const response = await askGPT(prompt, 50); // Adjust the max_tokens value for the daily diet overview

    // Format the response into the desired JSON object
    const dietOverview = [];
    let currentMeal = null;
    const lines = response.split("\n");
    for (let line of lines) {
      if (line.startsWith("- ")) {
        const food = line.substring(2);
        if (currentMeal) {
          currentMeal.food.push(food);
        }
      } else if (line.endsWith(":")) {
        const time = line.replace(":", "");
        currentMeal = { time, food: [] };
        dietOverview.push(currentMeal);
      }
    }

    return dietOverview;
  } catch (error) {
    console.error("Error generating daily diet overview:", error.message);
    return null;
  }
};

const generateOverview = async (options) => {
  let prompt = `Create a  diet overview for a ${options.healthGoal} individual with ${options.dietaryPreference} preferences for ${options.numDays} days. Make it  short  100 words max.It should be only overview of diet plan.Example: This diet includes smth. It's good for smth.It should include only UZBEK cousins`;

  // Send the prompt to OpenAI API for generating the short overview
  try {
    const response = await askGPT(prompt, 100); // Adjust the max_tokens value for the short overview
    return response;
  } catch (error) {
    console.error("Error generating overview:", error.message);
    return null;
  }
};

// Function to generate daily diet information
const getDayDiet = (days, dayNumber) => {
  const targetDay = days.find((day) => day.day === dayNumber);
  if (targetDay) {
    return targetDay.diet;
  }
  return null;
};

app.get("/", (req, res) => {
  res.send("App ready   !" + process.env.APIkey + "ANDAIDNAS");
});

app.post("/generate-diet", validateOptions(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const options = req.body;
  const generatedDiet = await generateOverview(options);

  if (generatedDiet) {
    // Send notifications for each day in the diet plan
    const days = extractDaysFromDietPlan(generatedDiet);
    res.json({ days });
  } else {
    res.status(500).json({ error: "Error generating diet plan" });
  }
});

// API endpoint for getting short overview of the diet plan
app.get("/getOverview", validateOptions(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const options = req.body;
  const overview = await generateOverview(options);

  if (overview) {
    res.json({ overview });
  } else {
    res.status(500).json({ error: "Error generating overview" });
  }
});

// API endpoint for getting daily diet information
app.get("/getDay/:dayNumber", validateOptions(), async (req, res) => {
  const dayNumber = parseInt(req.params.dayNumber);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  const options = req.body;
  const generatedDiet = await generateDailyDiet(options, dayNumber);

  if (generatedDiet) {
    res.json({ day: dayNumber, diet: generatedDiet });
  } else {
    res.status(500).json({ error: "Error generating diet plan" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
