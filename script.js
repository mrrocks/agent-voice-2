class AudioVisualizer {
    constructor() {
        this.siriWave = null;
        this.audioContext = null;
        this.analyser = null;
        this.animationId = null;
        this.lastFrameTime = 0;
        this.targetFPS = 60;
        
        this.elements = this.getElements();
        this.opacityControls = this.getOpacityControls();
        
        this.initialize();
    }

    getElements() {
        return {
            templateImage: document.getElementById('template-image'),
            siriWaveContainer: document.getElementById('siriwave-container'),
            canvasBlendSelect: document.getElementById('canvas-blend-select'),
            bgBlendSelect: document.getElementById('bg-blend-select'),
            imageStyleSelect: document.getElementById('image-style-select'),
            color1: document.getElementById('color1'),
            color2: document.getElementById('color2'),
            color3: document.getElementById('color3'),
            opacity1: document.getElementById('opacity1'),
            opacity2: document.getElementById('opacity2'),
            opacity3: document.getElementById('opacity3'),
            opacity1Value: document.getElementById('opacity1-value'),
            opacity2Value: document.getElementById('opacity2-value'),
            opacity3Value: document.getElementById('opacity3-value')
        };
    }

    getOpacityControls() {
        return [
            { slider: this.elements.opacity1, display: this.elements.opacity1Value },
            { slider: this.elements.opacity2, display: this.elements.opacity2Value },
            { slider: this.elements.opacity3, display: this.elements.opacity3Value }
        ];
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    getColorString(hex, opacity = 1) {
        const rgb = this.hexToRgb(hex);
        return opacity < 1 
            ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
            : `${rgb.r}, ${rgb.g}, ${rgb.b}`;
    }

    getCurveDefinition() {
        return [
            { color: "255,255,255", supportLine: true, opacity: 0 },
            { 
                color: this.getColorString(this.elements.color1.value),
                opacity: parseFloat(this.elements.opacity1.value)
            },
            { 
                color: this.getColorString(this.elements.color2.value),
                opacity: parseFloat(this.elements.opacity2.value)
            },
            { 
                color: this.getColorString(this.elements.color3.value),
                opacity: parseFloat(this.elements.opacity3.value)
            }
        ];
    }

    applyStyles() {
        const backgroundBlendMode = this.elements.bgBlendSelect.value;
        const imageStyle = this.elements.imageStyleSelect.value;

        this.elements.siriWaveContainer.style.mixBlendMode = backgroundBlendMode;

        this.elements.templateImage.classList.toggle('circle', imageStyle === 'circle');
        this.elements.templateImage.parentElement.classList.toggle('circle', imageStyle === 'circle');
        
        const container = this.elements.templateImage.parentElement;
        if (imageStyle === 'circle') {
            container.style.width = '400px';
            container.style.height = '400px';
        } else {
            container.style.width = '';
            container.style.height = '';
        }
    }

    calculateDimensions() {
        const containerWidth = this.elements.templateImage.offsetWidth;
        const containerImageHeight = this.elements.templateImage.offsetHeight;
        const imageStyle = this.elements.imageStyleSelect.value;
        
        const referenceDimension = imageStyle === 'circle' 
            ? Math.min(containerWidth, containerImageHeight)
            : containerImageHeight;
        
        const containerMaxHeight = referenceDimension * 4;
        const extension = imageStyle === 'circle' ? 0.6 : 0.3;
        const waveWidth = containerWidth * (1 + extension * 2);
        const leftOffset = -containerWidth * extension;
        
        return {
            containerWidth,
            containerMaxHeight,
            waveWidth,
            leftOffset
        };
    }

    initializeSiriWave() {
        const { containerWidth, containerMaxHeight, waveWidth, leftOffset } = this.calculateDimensions();
        
        Object.assign(this.elements.siriWaveContainer.style, {
            width: `${waveWidth}px`,
            height: `${containerMaxHeight}px`,
            left: `${leftOffset}px`
        });

        if (this.siriWave) {
            this.siriWave.dispose();
        }

        const config = {
            container: this.elements.siriWaveContainer,
            width: waveWidth,
            height: containerMaxHeight,
            style: 'ios9',
            amplitude: 3,
            speed: 0.2,
            autostart: false,
            cover: true,
            curveDefinition: this.getCurveDefinition(),
            globalCompositeOperation: this.elements.canvasBlendSelect.value
        };

        this.siriWave = new SiriWave(config);
    }

    updateWave() {
        if (this.siriWave) {
            this.siriWave.stop();
        }
        
        this.applyStyles();
        
        setTimeout(() => {
            this.initializeSiriWave();
            if (this.audioContext?.state === 'running') {
                this.lastFrameTime = 0;
                this.frameRateIndependentAnimation();
            }
        }, 100);
    }

    setupEventListeners() {
        this.elements.templateImage.addEventListener('load', () => this.initializeSiriWave());
        window.addEventListener('resize', () => this.initializeSiriWave());

        const updateElements = [
            this.elements.canvasBlendSelect, 
            this.elements.bgBlendSelect, 
            this.elements.imageStyleSelect,
            this.elements.color1,
            this.elements.color2,
            this.elements.color3
        ];

        updateElements.forEach(element => {
            element.addEventListener('change', () => this.updateWave());
        });

        this.opacityControls.forEach(({ slider, display }) => {
            slider.addEventListener('input', (e) => {
                display.textContent = parseFloat(e.target.value).toFixed(1);
                this.updateWave();
            });
        });
    }

    async startAudioVisualization() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });

            this.audioContext = new AudioContext();
            this.analyser = this.audioContext.createAnalyser();
            const mediaStreamSource = this.audioContext.createMediaStreamSource(stream);

            mediaStreamSource.connect(this.analyser);
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;

            this.lastFrameTime = 0;
            this.frameRateIndependentAnimation();
        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.lastFrameTime = 0;
            this.frameRateIndependentAnimation();
        }
    }

    frameRateIndependentAnimation = (currentTime = 0) => {
        if (this.lastFrameTime === 0) {
            this.lastFrameTime = currentTime;
            this.siriWave.start();
        }
        
        const deltaTime = currentTime - this.lastFrameTime;
        const currentFPS = deltaTime > 0 ? 1000 / deltaTime : 60;
        const speedMultiplier = this.targetFPS / currentFPS;
        const normalizedSpeed = 0.2 * speedMultiplier;
        
        if (this.analyser) {
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            this.analyser.getByteFrequencyData(dataArray);
            
            const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
            const normalizedAmplitude = Math.max(0.1, average / 255 * 3);
            
            this.siriWave.setAmplitude(normalizedAmplitude);
        }
        
        this.siriWave.setSpeed(Math.max(0.05, Math.min(normalizedSpeed, 0.5)));
        
        this.lastFrameTime = currentTime;
        this.animationId = requestAnimationFrame(this.frameRateIndependentAnimation);
    }

    cleanup() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.siriWave) {
            this.siriWave.dispose();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }

    initialize() {
        this.setupEventListeners();
        this.applyStyles();
        this.initializeSiriWave();
        
        setTimeout(() => {
            this.startAudioVisualization();
        }, 500);
    }
}

window.addEventListener('load', () => {
    const visualizer = new AudioVisualizer();
    
    window.addEventListener('beforeunload', () => {
        visualizer.cleanup();
    });
}); 