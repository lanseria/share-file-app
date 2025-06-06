# ws

docker build -t my-signaling-server:latest .

docker run -d -p 3000:8080 --name signaling-server my-signaling-server:latest
