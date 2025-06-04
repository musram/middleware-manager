1. Install DNS utilities
```bash
sudo apt-get update && sudo apt-get install -y dnsutils
```

2. Current DNS records
```bash
dig mcp.api.deepalign.ai
```

3. Current server address
```bash
curl -s ifconfig.me
```
4. 
    1. Log into Namecheap Account:
        - Go to https://www.namecheap.com/
        - Click "Sign In" and enter your credentials
    2. Access Domain List:
        - Click on "Domain List" in the left sidebar
        - Find and click on "deepalign.ai"
    3. Update DNS Records:
        - Click on "Advanced DNS"
        - Find the existing A record for mcp.api.deepalign.ai
        - You have two options:
        Option 1 - Update Existing Record:
            - Click the edit (pencil) icon next to the existing A record
            - Change the IP from 34.67.237.108 to 34.77.77.77
            - Click the checkmark to save
        Option 2 - Create New Record (if you want to keep both servers):
            - Click "Add New Record"
            - Select "A Record"
            - Host: mcp.api.deepalign.ai
            - Value: 34.77.77.77
            - TTL: Automatic or 30 minutes (for faster propagation)
            - Click the checkmark to save
        Additional Records Needed:
            - Add a CNAME record for www subdomain:
                - Click "Add New Record"
                - Select "CNAME Record"
                - Host: www.mcp.api.deepalign.ai
                - Value: mcp.api.deepalign.ai
                - TTL: Automatic
                - Click the checkmark to save
        Verify DNS Propagation:
        After making changes, you can verify the propagation using:
        ```bash
           dig mcp.api.deepalign.ai
        ```
        It might take some time (usually 5-30 minutes) for the changes to propagate globally.
        Update Your Configuration:
.
        SSL Certificate:
        Since you're using Let's Encrypt in your Traefik configuration, it will automatically obtain an SSL certificate for your domain once the DNS is properly configured.
        Would you like me to help you verify the DNS propagation once you've made these changes in Namecheap?