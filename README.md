# ws

```bash
docker build -t my-signaling-server:latest .
docker stop signaling-server
docker rm signaling-server
docker run -d \
 -p 3000:8080 \
 --name signaling-server \
 --restart unless-stopped \
 my-signaling-server:latest
```
