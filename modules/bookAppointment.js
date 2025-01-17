const fs = require("fs");
const getPage = require("./solveCaptcha");
const { submitCaptchaForSolving } = require("./captchaSolver");

async function bookAppointment(browser, link) {
  const userFilePath = "user.json";
  if (!fs.existsSync(userFilePath)) {
    console.log(
      "Error: user.json file does not exist. Script will not proceed."
    );
    return;
  }
  const userData = JSON.parse(fs.readFileSync(userFilePath, "utf8"));

  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  await page.goto(link, { waitUntil: "domcontentloaded" });
  await getPage(page);
  console.log("checking appointments");
  // Extract the "Book this appointment" URL only if the text content matches
  const appointmentLink = await page.evaluate(() => {
    // Find all the anchor tags with the class 'arrow'
    const links = document.querySelectorAll("a.arrow");

    for (let link of links) {
      // Check if the text of the link matches "Book this appointment"
      if (link.textContent.toLowerCase().trim() === "book this appointment") {
        return link.href; // Return the href of the matching link
      }
    }
    return null; // Return null if no matching link is found
  });

  await page.goto(appointmentLink, { waitUntil: "domcontentloaded" });
  // Step 4: Helper function to fill input fields if they exist
  console.log("inputing data");
  async function fillInput(selector, value) {
    const input = await page.$(selector);
    if (input) {
      await input.type(value);
      console.log(
        `Filled input with selector '${selector}' with value: ${value}`
      );
    } else {
      console.log(`Input with selector '${selector}' not found.`);
    }
  }

  // Step 5: Fill the form with the data from 'user.json'
  await fillInput('input[name="firstname"]', userData.firstName);
  await fillInput('input[name="lastname"]', userData.lastName);
  await fillInput('input[name="email"]', userData.email);
  await fillInput('input[name="emailrepeat"]', userData.email);
  await fillInput('input[name="fields[0].content"]', userData.passportNumber);
  await fillInput('input[name="phonenumber"]', userData.phoneNumber);
  await fillInput('input[name="Province"]', userData.Province);
  await fillInput('input[name="Country"]', userData.Country);
  await fillInput('input[name="DOB"]', userData.DOB);
  await fillInput('input[name="cgpa"]', userData.cgpa);

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
        await page.click('input[name="action:appointment_addAppointment"]');
        await page.waitForNavigation();
        return;
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

module.exports = bookAppointment;
