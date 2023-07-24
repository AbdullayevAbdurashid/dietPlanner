const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Personalized Diet API",
      version: "1.0.0",
      description: "API for generating personalized diet plans using OpenAI",
    },
  },
  apis: ["app.js"],
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local Development Server",
    },
  ],
};

module.exports = swaggerOptions;
