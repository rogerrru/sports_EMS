document.addEventListener('DOMContentLoaded', function () {
    const eventItems = document.querySelectorAll('.eventItem');

    function fadeInElements() {
        eventItems.forEach(function (item, index) {
            setTimeout(function () {
                item.classList.add('fadeInAnimation');
            }, index * 100);
        });
    }

    fadeInElements();

    const toggleQRButtons = document.querySelectorAll('.toggleQR');

    toggleQRButtons.forEach(button => {
        button.addEventListener('click', function () {
            const qrImage = button.nextElementSibling;
            if (qrImage.style.display === 'none') {
                qrImage.style.display = 'block';
                button.textContent = 'Hide QR Code';
            } else {
                qrImage.style.display = 'none';
                button.textContent = 'Show QR Code';
            }
        });
    });

    let currentIndex = 0;

    const indicatorsContainer = document.querySelector('.indicators');

    // Create indicators based on the number of event items
    for (let i = 0; i < eventItems.length; i++) {
        const indicator = document.createElement('div');
        indicator.classList.add('indicator');
        indicatorsContainer.appendChild(indicator);
    }

    function updateIndicators() {
        const indicators = document.querySelectorAll('.indicator');
        indicators.forEach((indicator, index) => {
            if (index === currentIndex) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
    }

    updateIndicators(); // Call initially


    updateDisplay();

    function updateDisplay() {
        eventItems.forEach((item, index) => {
            if (index === currentIndex) {
                item.classList.add('visible');
            } else {
                item.classList.remove('visible');
            }
        });
        updateIndicators();
    }

    updateDisplay();
    const nextButtons = document.querySelectorAll('.slide-btn');
    const prevButtons = document.querySelectorAll('.Previous-btn');

    // Function to handle Next button click
    function clickNext() {
        currentIndex = (currentIndex + 1) % eventItems.length;
        updateDisplay();
        console.log("Next button clicked");
    }

    // Function to handle Previous button click
    function clickPrevious() {
        currentIndex = (currentIndex - 1 + eventItems.length) % eventItems.length;
        updateDisplay();
        console.log("Previous button clicked");
    }

    // Attach event listeners to all Next buttons
    nextButtons.forEach(button => {
        button.addEventListener("click", clickNext);
    });

    // Attach event listeners to all Previous buttons
    prevButtons.forEach(button => {
        button.addEventListener("click", clickPrevious);
    });
});



