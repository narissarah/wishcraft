module.exports = (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>WishCraft - Gift Registry App</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
        body { font-family: system-ui; margin: 0; padding: 40px; text-align: center; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .logo { font-size: 4em; margin-bottom: 20px; }
        .title { color: #004c3f; margin-bottom: 20px; }
        .status { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .info { color: #666; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🎁</div>
        <h1 class="title">WishCraft Gift Registry</h1>
        <div class="status">✅ Successfully Deployed - No More Crashes!</div>
        <p class="info">Built for Shopify 2025 API Compliance</p>
        <p class="info">Timestamp: ${new Date().toISOString()}</p>
        <div style="margin-top: 30px;">
            <a href="/app" style="background: #004c3f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Open App Interface</a>
        </div>
    </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).send(html);
};