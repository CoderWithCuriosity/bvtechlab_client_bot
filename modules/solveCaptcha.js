const { submitCaptchaForSolving } = require("./captchaSolver");

async function getPage(page) {
  let countRetry = 3;
  while (countRetry > 0) {
    // Wait for the CAPTCHA image to load and get the base64 data
    const base64Image = await page.evaluate(() => {
      const regex = /url\("data:image\/[a-zA-Z]+;base64,([A-Za-z0-9+/=]+)"\)/;
      const captchaImage = document.querySelector("captcha div");
      if (captchaImage) {
        return captchaImage.style.backgroundImage.match(regex)[1]; // Extract the Base64 string
      }
      return null;
    });
    if (base64Image) {
      // Submit the CAPTCHA to TrueCaptcha for solving
      const solution = await submitCaptchaForSolving(base64Image);
      if (solution) {
        console.log("CAPTCHA solved:", solution);
        // Fill the CAPTCHA solution in the input field (adjust selector as needed)
        await page.type('input[name="captchaText"]', solution); // Replace with the actual input name or selector
        // Optionally, submit the form or click a button after solving the CAPTCHA
        await page.click('input[value="Continue"]');
        await page.waitForNavigation();
        const checkCaptcha = await page.evaluate(() => {
          const captchaImage = document.querySelector("captcha div");
          if (captchaImage) {
            return true;
          }
          return false;
        });
        if (!checkCaptcha) {
          console.log("Form submitted after CAPTCHA solved!");
          return;
        }
      } else {
        console.error("Failed to solve the CAPTCHA.");
      }
    } else {
      const checkInputCaptcha = await page.evaluate(() => {
        const captchaText = document.querySelector("input[name='captchaText']");
        if (captchaText) {
          return true;
        }
        return false;
      });
      if (!checkInputCaptcha) {
        return;
      }
      console.error("No CAPTCHA image found.");
    }
    countRetry--;
    console.log(countRetry);

    await page.click('input[value="Load another picture"]');
    await new Promise(resolve => {
      setTimeout(resolve, 2000);
    });
  }
  if (countRetry <= 0) {
    console.log(
      "Recaptcha solver unable to solve the captcha. Please contact the developer."
    );
    return;
  }
}

module.exports = getPage;
