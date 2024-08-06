document.addEventListener("DOMContentLoaded", () => {
  const nameSelect = document.getElementById("name");
  const batchNameSelect = document.getElementById("batch-name");
  const shiftTypeSelect = document.getElementById("shift_type");
  const availableShiftTypesDiv = document.getElementById(
    "available-shift-types"
  );
  const responseContainer = document.getElementById("response-container");
  const responsePre = document.getElementById("response");

  // Formular-Toggles
  const singleFormDiv = document.getElementById("single-form");
  const batchFormDiv = document.getElementById("batch-form");
  const showSingleFormBtn = document.getElementById("show-single-form");
  const showBatchFormBtn = document.getElementById("show-batch-form");

  showSingleFormBtn.addEventListener("click", () => {
    singleFormDiv.classList.remove("hidden");
    batchFormDiv.classList.add("hidden");
  });

  showBatchFormBtn.addEventListener("click", () => {
    singleFormDiv.classList.add("hidden");
    batchFormDiv.classList.remove("hidden");
  });

  async function fetchOptions() {
    try {
      const response = await fetch("/api/options");
      const data = await response.json();

      data.names.forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        nameSelect.appendChild(option.cloneNode(true));
        batchNameSelect.appendChild(option.cloneNode(true));
      });

      nameSelect.addEventListener("change", async function () {
        const selectedName = this.value;
        shiftTypeSelect.innerHTML = '<option value="">Bitte auswählen</option>';
        if (selectedName) {
          await fetchShiftTypes(selectedName.toLowerCase(), "single");
        }
      });
    } catch (error) {
      console.error("Fehler beim Abrufen der Optionen:", error);
    }
  }

  async function fetchShiftTypes(name, formType) {
    try {
      const response = await fetch(`/api/shift_types/${name}`);
      const data = await response.json();

      if (formType === "batch") {
        availableShiftTypesDiv.innerHTML =
          "<strong>Verfügbare Schichten:</strong><ul>";
        data.shift_types.forEach((shiftType) => {
          availableShiftTypesDiv.innerHTML += `<li>${shiftType}</li>`;
        });
        availableShiftTypesDiv.innerHTML += "</ul>";
      } else if (formType === "single") {
        data.shift_types.forEach((shiftType) => {
          const option = document.createElement("option");
          option.value = shiftType;
          option.textContent = shiftType;
          shiftTypeSelect.appendChild(option);
        });
      }
    } catch (error) {
      console.error("Fehler beim Abrufen der Schichttypen:", error);
    }
  }

  document
    .getElementById("shift-form")
    .addEventListener("submit", async function (event) {
      event.preventDefault();
      const name = nameSelect.value;
      const date = document.getElementById("date").value;
      const shiftType = shiftTypeSelect.value;

      try {
        const response = await fetch("/add_shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([{ name, date, shift_type: shiftType }]),
        });
        const data = await response.json();
        responsePre.textContent = JSON.stringify(data, null, 2);
        responseContainer.classList.remove("hidden");
        this.reset();
      } catch (error) {
        console.error("Fehler beim Hinzufügen der einzelnen Schicht:", error);
      }
    });

  document
    .getElementById("batch-form")
    .addEventListener("submit", async function (event) {
      event.preventDefault();
      const name = batchNameSelect.value;
      const shiftsText = document.getElementById("batch-shifts").value;

      const currentYear = new Date().getFullYear();
      const shifts = shiftsText
        .trim()
        .split("\n")
        .map((line) => {
          const [date, shiftType] = line.split(":");
          const [day, month] = date.trim().split(".");
          const formattedDate = `${currentYear}-${month.padStart(
            2,
            "0"
          )}-${day.padStart(2, "0")}`;
          return {
            name,
            date: formattedDate,
            shift_type: shiftType.trim(),
          };
        });

      try {
        const response = await fetch("/add_shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(shifts),
        });
        const data = await response.json();
        responsePre.textContent = JSON.stringify(data, null, 2);
        responseContainer.classList.remove("hidden");
      } catch (error) {
        console.error("Fehler beim Batch-Import:", error);
      }
    });

  fetchOptions();
});
