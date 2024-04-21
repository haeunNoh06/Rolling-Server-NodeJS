const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });

const options = {
  info: {
    title: 'Rolling',
    description: '롤링페이퍼 서비스',
  },
  servers: [
    {
      url: 'http://localhost:3000',
    },
  ],
  schemes: ['http'],
  securityDefinitions: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      in: 'header',
      bearerFormat: 'JWT',
    },
  },
};
const outputFile = './swagger-output.json';
const endpointsFiles = ['./rollingpaper.js'];
swaggerAutogen(outputFile, endpointsFiles, options);