/** ================================
   * CONNSTANTS 
   * ================================*/
  const COUNTDOWN_DURATION = 120;
  let timerInterval;
  let turnstileToken = null;

  const contactInput = document.getElementById('contact');
  const continueBtn = document.getElementById('continueBtn');
  const clearBtn = document.getElementById('clearBtn');
  const otpScreen = document.getElementById('otp-screen');
  const otpBox = document.querySelector('.otp-box');
  const otpMsg = document.getElementById("otp-msg");
  const contactForm = document.getElementById('contact-form');
  const waLinkEl = document.getElementById('wa-link');
  const countdownEl = document.getElementById('countdown');
  const contactMsg = document.getElementById("contact-msg");
  const otpInputs = Array.from(document.querySelectorAll('.otp'));
  const verificationMethods = document.querySelectorAll('input[name="verificationMethod"]');

  const linkScreen        = document.getElementById("link-screen");
  const lscreenContinue   = document.getElementById("lscreen-continue-btn");
  const lscreenBack       = document.getElementById("lscreen-back-btn");

  const successScreen = document.getElementById('success-screen');
  const successBtn = document.getElementById('successBtn');
  const canvas = document.getElementById("qrcode");

  canvas.addEventListener("click", () => {
    window.open(localStorage.getItem("link"), "_blank", "noopener,noreferrer");
  });

  function updateSubmitState() {
    const hasValue = contactInput.value.trim().length > 0;
    continueBtn.disabled = !(turnstileToken && hasValue);
  }

  function onSuccess(token) {
    if (token) {
      turnstileToken = token;
      continueBtn.dataset.token = token;
      updateSubmitState();
    }
  }


  document.addEventListener('DOMContentLoaded', () => {
    const expired = localStorage.getItem('expired');
    if (!expired) return;

    const expiryTime = new Date(expired).getTime();

    if (Date.now() > expiryTime) {
      localStorage.clear();
      return;
    }

    const screen = localStorage.getItem("screen");

    contactForm.style.display = "none";

    if (screen === "otp") {
      otpScreen.classList.add("show");
      otpScreen.setAttribute("aria-hidden", "false");
      startTimer(countdownEl);
      setTimeout(() => otpInputs[0].focus(), 120);
    } else if (localStorage.getItem("link")) {
      linkScreen.classList.add("show");
      linkScreen.setAttribute("aria-hidden", "false");
      generateQRCode();
    } else {
      localStorage.clear();
    }
  });


  function updatePlaceholder() {
    const selectedMethod = document.querySelector('input[name="verificationMethod"]:checked').value;

    if (selectedMethod === "email") {
      contactInput.inputMode = "email";
      contactInput.placeholder = "e.g. work@fadelnasution.id";
      contactInput.setAttribute("aria-label", "Email address");
    } else {
      contactInput.inputMode = "tel";
      contactInput.placeholder = "e.g. 081234567890";
      contactInput.setAttribute("aria-label", "Phone number");
    }

    contactInput.value = "";
    updateSubmitState();
  }

  verificationMethods.forEach((radio) => {
    radio.addEventListener("change", updatePlaceholder);
  });

  updatePlaceholder();


  contactInput.addEventListener("input", () => {
    const selectedMethod = document.querySelector('input[name="verificationMethod"]:checked').value;

    if (selectedMethod !== "email") {
      contactInput.value = contactInput.value.replace(/[^\d]/g, "");
    }

    clearMessage(contactMsg);
    updateSubmitState();
  });

  otpInputs.forEach((el) => {
    el.addEventListener("input", () => {
      clearMessage(otpMsg);
    });
  });


  /** ================================
   * HELPERS 
   * ================================*/

  function resetAllState() {
    contactInput.value = "";

    otpInputs.forEach(i => {
      i.value = "";
      i.disabled = false;
    });

    countdownEl.textContent = "00:00";

    localStorage.removeItem("channel");
    localStorage.removeItem("value");
    localStorage.removeItem("code");
    localStorage.removeItem("id");
    localStorage.removeItem("link");
    localStorage.removeItem("expired");
    localStorage.removeItem("screen");

    otpScreen.classList.remove("show");
    otpScreen.setAttribute("aria-hidden", "true");
    contactForm.style.display = "block";

    contactInput.focus();
  }

  function normalizePhone(input) {
    const numbers = input.replace(/\D/g, "");

    if (!numbers) return "";

    if (numbers.startsWith("0")) {
      return "62" + numbers.slice(1);
    }

    if (numbers.startsWith("62")) {
      return numbers;
    }

    return "";
  }

  function showMessage(el, message, type = "error") {
    el.textContent = message;
    el.classList.remove("success");
    if (type === "success") el.classList.add("success");
    el.classList.add("show");
  }

  function clearMessage(el) {
    el.textContent = "";
    el.classList.remove("show", "success");
  }

  function setOtpVerifying(isVerifying) {
    otpBox.classList.toggle("otp-verifying", isVerifying);
  }


  /** ================================
   * SHARED: SEND OTP (used by submit + resend)
   * ================================*/
  async function sendOtpRequest(channel, value) {
    const response = await fetch("/api/otp/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer nV7hR2qWy5FzXtCk9PbL8sJD3UoAeYmN",
      },
      body: JSON.stringify({
        channel,
        value,
        turnstile_token: typeof turnstile !== "undefined"
          ? turnstile.getResponse()
          : undefined
      })
    });

    return response.json();
  }


  /** ================================
   * EVENT: SUBMIT
   * ================================*/
  continueBtn.addEventListener("click", async () => {
    const selectedMethod = document.querySelector(
      'input[name="verificationMethod"]:checked'
    )?.value;

    const rawContact = contactInput.value.trim();
    clearMessage(contactMsg);

    if (!selectedMethod) {
      showMessage(contactMsg, "Please select a verification method.");
      return;
    }

    let value = rawContact;

    if (selectedMethod === "email") {
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawContact);

      if (!validEmail) {
        showMessage(contactMsg, "Please enter a valid email address.");
        contactInput.focus();
        return;
      }

      value = rawContact.toLowerCase();
    } else {
      value = normalizePhone(rawContact);

      if (!value) {
        showMessage(contactMsg, "Please enter a valid phone number.");
        contactInput.focus();
        return;
      }
    }

    contactInput.disabled = true;
    continueBtn.disabled = true;
    continueBtn.innerText = "Loading...";

    try {
      const result = await sendOtpRequest(selectedMethod, value);

      if (!result.success) {
        showMessage(
          contactMsg,
          result.message || "Failed to send verification code."
        );

        if (typeof turnstile !== "undefined") {
          turnstile.reset();
        }
        turnstileToken = null;
        continueBtn.disabled = true;
        return;
      }

      const { id, link, expiredAt, code } = result.data || {};

      if (id) {
        localStorage.setItem("id", id);
      }

      if (code) {
        localStorage.setItem("code", code);
      }

      localStorage.setItem("channel", selectedMethod);
      localStorage.setItem("value", value);

      if (expiredAt) {
        localStorage.setItem("expired", expiredAt);
      }

      contactForm.style.display = "none";

      if (link) {
        localStorage.setItem("link", link);
        localStorage.setItem("screen", "link");

        waLinkEl.href = link;
        waLinkEl.removeAttribute("data-resend-mode");

        window.open(link, "_blank", "noopener,noreferrer");

        linkScreen.classList.add("show");
        linkScreen.setAttribute("aria-hidden", "false");

        generateQRCode();
      } else {
        localStorage.removeItem("link");
        waLinkEl.href = "javascript:void(0)";
        waLinkEl.setAttribute("data-resend-mode", "email");

        localStorage.setItem("screen", "otp");
        otpScreen.classList.add("show");
        otpScreen.setAttribute("aria-hidden", "false");
        setTimeout(() => otpInputs[0]?.focus(), 120);
      }

      startTimer(countdownEl);
    } catch (error) {
      console.error("OTP request failed:", error);
      showMessage(contactMsg, "Failed to process your request. Please try again.");
    } finally {
      continueBtn.innerText = "Submit";
      contactInput.disabled = false;
    }
  });


  /** ================================
   * EVENT: CLEAR
   * ================================*/
  clearBtn.addEventListener('click', () => {
    contactInput.value = '';
    clearMessage(contactMsg);
    contactInput.focus();
    updateSubmitState();
  });


  /** ================================
   * EVENT: OTP
   * ================================*/
  otpInputs.forEach((el, idx) => {
    el.addEventListener('input', (e) => {
      const val = e.target.value;
      e.target.value = val.replace(/[^\d]/g, '').slice(0,1);
      if(e.target.value && idx < otpInputs.length - 1) {
        otpInputs[idx + 1].focus();
      }

      if (otpInputs.every(i => i.value)) {
        const otp = otpInputs.map(i => i.value).join('');

        const storedChannel = localStorage.getItem("channel");
        const storedCode = localStorage.getItem("code");
        const storedValue = localStorage.getItem("value");

        const isEmailChannel = storedChannel === 'email';

        if (!storedValue || (!isEmailChannel && !storedCode)) {
          showMessage(
            otpMsg,
            "Verification data missing. Please restart the process."
          );
          return;
        }

        otpInputs.forEach(i => i.disabled = true);
        setOtpVerifying(true);

        fetch("/api/otp/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer nV7hR2qWy5FzXtCk9PbL8sJD3UoAeYmN",
          },
          body: JSON.stringify({
            action: "verifyOtp",
            value: storedValue,
            code: isEmailChannel ? null : storedCode,
            otp: otp,
          }),
        })
          .then((response) => response.json())
          .then((response) => {
            setOtpVerifying(false);

            if (!response.success) {
              showMessage(
                otpMsg,
                response.message || "Verification failed. Please check the code."
              );
              otpInputs.forEach(i => {
                i.disabled = false;
                i.value = "";
              });
              otpInputs[0].focus();
              return;
            }

            otpScreen.classList.remove("show");
            otpScreen.setAttribute("aria-hidden", "true");

            successScreen.classList.add("show");
            successScreen.setAttribute("aria-hidden", "false");

            localStorage.clear();
          })
          .catch((err) => {
            console.error("API ERROR:", err);
            setOtpVerifying(false);
            showMessage(otpMsg, "Verification failed. Please try again.");
            otpInputs.forEach(i => i.disabled = false);
          });
      }
    });

    el.addEventListener('keydown', (e) => {
      if(e.key === 'Backspace' && !e.target.value && idx > 0){
        otpInputs[idx - 1].focus();
      }
      if(e.key === 'ArrowLeft' && idx > 0) otpInputs[idx - 1].focus();
      if(e.key === 'ArrowRight' && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
    });
  });


  /** ================================
   * ENTER TO CONTINUE
   * ================================*/
  contactInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') continueBtn.click();
  });


  successBtn.addEventListener('click', () => {
    successScreen.classList.remove("show");
    successScreen.setAttribute("aria-hidden", "true");
    if (typeof turnstile !== "undefined") {
      turnstile.reset();
    }
    turnstileToken = null;
    resetAllState();
  });


  /** ================================
   * PRE_FILL PHONE
   * ================================*/
  (function prefillFromQuery(){
    try{
      const params = new URLSearchParams(window.location.search);
      const p = params.get('phone') || params.get('tel') || '';
      if(p){
        contactInput.value = p;
        updateSubmitState();
      }
    }catch(e){}
  })();


  /** ================================
   * COUNT DOWN
   * ================================*/
  function startTimer(display) {
    clearInterval(timerInterval);

    const expiredStr = localStorage.getItem('expired');
    if (!expiredStr) {
      waLinkEl.style.display = 'block';
      display.style.display = 'none';
      return;
    }

    const expiredAt = new Date(expiredStr).getTime();

    function getRemainingSeconds() {
      return Math.max(0, Math.floor((expiredAt - Date.now()) / 1000));
    }

    if (getRemainingSeconds() === 0) {
      localStorage.removeItem('expired');
      waLinkEl.style.display = 'block';
      display.style.display = 'none';
      return;
    }

    waLinkEl.style.display = 'none';
    display.style.display = 'block';

    timerInterval = setInterval(function () {
      const remaining = getRemainingSeconds();
      const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
      const seconds = String(remaining % 60).padStart(2, '0');

      display.textContent = 'Resend code in ' + minutes + ':' + seconds;

      if (remaining <= 0) {
        clearInterval(timerInterval);
        localStorage.removeItem('expired');
        display.style.display = 'none';
        waLinkEl.style.display = 'block';
      }
    }, 1000);
  }

  
  /** ================================
   * RESEND CODE (differs per channel)
   * ================================*/
  waLinkEl.addEventListener('click', async (e) => {
    const storedChannel = localStorage.getItem("channel");
    const storedValue = localStorage.getItem("value");

    if (storedChannel === 'email') {
      e.preventDefault();

      if (!storedValue) {
        showMessage(otpMsg, "Verification data missing. Please restart the process.");
        return;
      }

      const originalText = waLinkEl.textContent;
      waLinkEl.textContent = "Sending...";
      waLinkEl.style.pointerEvents = "none";

      try {
        const result = await sendOtpRequest('email', storedValue);

        if (!result.success) {
          showMessage(otpMsg, result.message || "Failed to resend OTP email.");
          return;
        }

        const { expiredAt } = result.data || {};
        if (expiredAt) {
          localStorage.setItem("expired", expiredAt);
        }

        showMessage(otpMsg, "A new OTP has been sent to your email.", "success");
        setTimeout(() => startTimer(countdownEl), 500);
      } catch (err) {
        console.error("Resend OTP error:", err);
        showMessage(otpMsg, "Failed to resend OTP. Please try again.");
      } finally {
        waLinkEl.textContent = originalText;
        waLinkEl.style.pointerEvents = "";
      }

      return;
    }

    setTimeout(() => {
      startTimer(countdownEl);
    }, 500);
  });


  /** ================================
   * LINK SCREEN ELEMENTS
   * ================================*/
  function hideLinkScreen() {
    linkScreen.classList.remove("show");
    linkScreen.setAttribute("aria-hidden", "true");
  }

  lscreenContinue.addEventListener("click", () => {
    localStorage.setItem("screen", "otp");
    hideLinkScreen();
    otpScreen.classList.add("show");
    otpScreen.setAttribute("aria-hidden", "false");
    startTimer(countdownEl);
    setTimeout(() => otpInputs[0].focus(), 120);
  });

  lscreenBack.addEventListener("click", () => {
    if (typeof turnstile !== "undefined") {
      turnstile.reset();
    }
    turnstileToken = null;
    hideLinkScreen();
    contactForm.style.display = "block";
    contactInput.disabled = false;
    continueBtn.disabled = true; 
    localStorage.clear();
    contactInput.focus();
  });


  function generateQRCode() {
    const url = localStorage.getItem('link');
    const canvas = document.getElementById('qrcode');

    if (!url) {
      console.error('No link found in localStorage.');
      return;
    }

    if (!canvas) {
      console.error('QR canvas element not found.');
      return;
    }

    QRCode.toCanvas(
      canvas,
      url,
      {
        width: 200,
        margin: 2
      },
      function (error) {
        if (error) {
          console.error('QR code generation failed:', error);
        }
      }
    );
  }