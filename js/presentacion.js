document.addEventListener('DOMContentLoaded', () => {
    const slides = Array.from(document.querySelectorAll('.slide'));
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const currentSlideNum = document.getElementById('currentSlideNum');
    const totalSlidesNum = document.getElementById('totalSlidesNum');
    const dotsContainer = document.getElementById('dotsContainer');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    let currentIndex = 0;
    const totalSlides = slides.length;
    totalSlidesNum.textContent = String(totalSlides);

    // Crear puntitos de navegación inferiores
    slides.forEach((_, idx) => {
        const dot = document.createElement('div');
        dot.className = `dot ${idx === 0 ? 'active' : ''}`;
        dot.title = `Ir a diapositiva ${idx + 1}`;
        dot.addEventListener('click', () => goToSlide(idx));
        dotsContainer.appendChild(dot);
    });

    const dots = Array.from(dotsContainer.querySelectorAll('.dot'));

    function updateDeck() {
        slides.forEach((slide, idx) => {
            slide.classList.toggle('active', idx === currentIndex);
        });

        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === currentIndex);
        });

        currentSlideNum.textContent = String(currentIndex + 1);
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === totalSlides - 1;
    }

    function goToSlide(index) {
        if (index >= 0 && index < totalSlides) {
            currentIndex = index;
            updateDeck();
        }
    }

    prevBtn.addEventListener('click', () => goToSlide(currentIndex - 1));
    nextBtn.addEventListener('click', () => goToSlide(currentIndex + 1));

    // Navegación con flechas del teclado y barra espaciadora
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === ' ') {
            e.preventDefault();
            goToSlide(currentIndex + 1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goToSlide(currentIndex - 1);
        } else if (e.key.toLowerCase() === 'f') {
            toggleFullScreen();
        }
    });

    function toggleFullScreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    }

    fullscreenBtn.addEventListener('click', toggleFullScreen);
});
