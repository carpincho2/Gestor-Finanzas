(() => {
    /**
     * Controlador modular de la presentación interactiva de Flujo.
     * Soporta navegación por teclado/clic, barra de progreso,
     * modo pantalla completa, impresión a PDF y panel de guion del orador.
     */
    const getElements = () => ({
        slides: Array.from(document.querySelectorAll('.slide')),
        prevBtn: document.getElementById('prevBtn'),
        nextBtn: document.getElementById('nextBtn'),
        currentSlideNum: document.getElementById('currentSlideNum'),
        totalSlidesNum: document.getElementById('totalSlidesNum'),
        dotsContainer: document.getElementById('dotsContainer'),
        progressFill: document.getElementById('progressFill'),
        fullscreenBtn: document.getElementById('fullscreenBtn'),
        printBtn: document.getElementById('printBtn'),
        notesBtn: document.getElementById('notesBtn'),
        closeNotesBtn: document.getElementById('closeNotesBtn'),
        speakerNotesPanel: document.getElementById('speakerNotesPanel'),
        speakerNotesText: document.getElementById('speakerNotesText'),
    });

    const createNavigationDots = (slides, container, onSelect) =>
        slides.map((_, idx) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = `dot ${idx === 0 ? 'active' : ''}`;
            dot.title = `Ir a diapositiva ${idx + 1}`;
            dot.setAttribute('aria-label', `Ir a diapositiva ${idx + 1}`);
            dot.addEventListener('click', () => onSelect(idx));
            container.appendChild(dot);
            return dot;
        });

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    };

    const initPresentation = () => {
        const ui = getElements();
        const totalSlides = ui.slides.length;
        if (!totalSlides) return;

        let currentIndex = 0;
        let notesVisible = false;

        ui.totalSlidesNum.textContent = String(totalSlides);

        const renderNotes = () => {
            const activeSlide = ui.slides[currentIndex];
            const notes = activeSlide.dataset.notes || 'Sin notas para esta diapositiva.';
            ui.speakerNotesText.textContent = notes;
        };

        const setNotesVisibility = (visible) => {
            notesVisible = visible;
            ui.speakerNotesPanel.hidden = !notesVisible;
            ui.notesBtn.setAttribute('aria-pressed', String(notesVisible));
            if (notesVisible) renderNotes();
        };

        const goToSlide = (index) => {
            if (index < 0 || index >= totalSlides) return;
            currentIndex = index;
            updateDeck();
        };

        const dots = createNavigationDots(ui.slides, ui.dotsContainer, goToSlide);

        const updateDeck = () => {
            ui.slides.forEach((slide, idx) => {
                slide.classList.toggle('active', idx === currentIndex);
            });
            dots.forEach((dot, idx) => {
                dot.classList.toggle('active', idx === currentIndex);
                dot.setAttribute('aria-selected', String(idx === currentIndex));
            });

            ui.currentSlideNum.textContent = String(currentIndex + 1);
            ui.prevBtn.disabled = currentIndex === 0;
            ui.nextBtn.disabled = currentIndex === totalSlides - 1;

            const pct = ((currentIndex + 1) / totalSlides) * 100;
            ui.progressFill.style.width = `${pct}%`;

            if (notesVisible) renderNotes();
        };

        ui.prevBtn.addEventListener('click', () => goToSlide(currentIndex - 1));
        ui.nextBtn.addEventListener('click', () => goToSlide(currentIndex + 1));
        ui.fullscreenBtn.addEventListener('click', toggleFullScreen);
        ui.printBtn.addEventListener('click', () => window.print());
        ui.notesBtn.addEventListener('click', () => setNotesVisibility(!notesVisible));
        ui.closeNotesBtn.addEventListener('click', () => setNotesVisibility(false));

        document.addEventListener('keydown', (event) => {
            const key = event.key;
            if (key === 'ArrowRight' || key === ' ' || key === 'PageDown') {
                event.preventDefault();
                goToSlide(currentIndex + 1);
            } else if (key === 'ArrowLeft' || key === 'PageUp') {
                event.preventDefault();
                goToSlide(currentIndex - 1);
            } else if (key === 'Home') {
                event.preventDefault();
                goToSlide(0);
            } else if (key === 'End') {
                event.preventDefault();
                goToSlide(totalSlides - 1);
            } else if (key.toLowerCase() === 'f') {
                toggleFullScreen();
            } else if (key.toLowerCase() === 'n') {
                setNotesVisibility(!notesVisible);
            }
        });

        updateDeck();
    };

    document.addEventListener('DOMContentLoaded', initPresentation);
})();
