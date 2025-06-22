# SafeRoomWeb Deployment Guide

This document provides instructions on how to deploy the SafeRoomWeb application using Docker and Docker Compose.

## Prerequisites

- Docker Desktop installed and running on the target machine.
- Your images (`ofekhalabi/saferoombackend:1.0.0` and `ofekhalabi/saferoomfrontend:1.0.0`) pushed to a container registry like Docker Hub.

## Deployment Steps

To deploy the application on a new computer, follow these steps:

1.  **Copy `docker-compose.yml` to the new computer.**

    You will need the following `docker-compose.yml` file. This version uses the pre-built images from Docker Hub.

    ```yaml
    services:
      backend:
        image: ofekhalabi/saferoombackend:1.0.0
        ports:
          - "4000:4000"
        volumes:
          - ./shelter_status.db:/app/shelter_status.db

      frontend:
        image: ofekhalabi/saferoomfrontend:1.0.0
        ports:
          - "8080:80"
        depends_on:
          - backend

    version: '3.8'
    ```

2.  **Create the database file.**

    In the same directory where you placed the `docker-compose.yml` file, create an empty file named `shelter_status.db`. The application needs this file to exist to store its data.

3.  **Run the application.**

    Open a terminal in that directory and run the following command:
    ```bash
    docker-compose up
    ```
    Docker will automatically download (pull) your application images from the registry and start the containers.

Once the process is complete, the application will be accessible at `http://localhost:8080`. 