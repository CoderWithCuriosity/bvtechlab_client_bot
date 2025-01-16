// Load environment variables from the .env file
require('dotenv').config();

async function submitCaptchaForSolving(base64Image) {
  const userId = process.env.TRUECAPTCHA_USER_ID; // Your TrueCaptcha userId
  const apiKey = process.env.TRUECAPTCHA_API_KEY; // Your TrueCaptcha apiKey

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      userid: userId, 
      apikey: apiKey, 
      data: base64Image,
    });
    

    fetch("https://api.apitruecaptcha.org/one/gettext", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data,
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.result) {
          resolve(result.result); // Captcha solution returned
        } else {
          console.error("Failed to get solution:", result.error || "Unknown error");
          resolve(null);
        }
      })
      .catch((error) => {
        console.error("Error during captcha solving request:", error);
        reject(error);
      });
  });
}

module.exports = { submitCaptchaForSolving };
