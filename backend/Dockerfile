# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install any needed packages
RUN npm install

# Bundle app source
COPY . .

# Make port 4000 available to the world outside this container
EXPOSE 4000

# Define the command to run the app
CMD [ "node", "server.js" ] 