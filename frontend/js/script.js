document.addEventListener("DOMContentLoaded", function () {
  console.log("HireHub JavaScript connected successfully");

  const buttons = document.querySelectorAll("button, .btn");

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      button.style.transform = "scale(0.97)";

      setTimeout(function () {
        button.style.transform = "scale(1)";
      }, 150);
    });
  });

  const forms = document.querySelectorAll("form");

  forms.forEach(function (form) {
    form.addEventListener("submit", function (event) {
      const inputs = form.querySelectorAll("input[required], textarea[required], select[required]");
      let isValid = true;

      inputs.forEach(function (input) {
        if (input.value.trim() === "") {
          isValid = false;
          input.style.border = "2px solid red";
        } else {
          input.style.border = "1px solid #ccc";
        }
      });

      if (!isValid) {
        event.preventDefault();
        alert("Please fill all required fields.");
      }
    });
  });

  const jobCards = document.querySelectorAll(".card, .job-card");

  jobCards.forEach(function (card) {
    card.addEventListener("mouseenter", function () {
      card.style.transform = "translateY(-5px)";
      card.style.transition = "0.3s";
    });

    card.addEventListener("mouseleave", function () {
      card.style.transform = "translateY(0)";
    });
  });
});