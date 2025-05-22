document.addEventListener('DOMContentLoaded', function () {
			// Audio context and analyser variables
			let analyser;
			let dataArray;
			let canvasContext;
			const visualizer = document.getElementById('audioVisualizer');

			// Radio state variables
			let currentRadio = null;
			let currentStationElement = null;
			let isMuted = false;
			let prevVolume = 0.3;

			// DOM element selectors
			const stationElements = document.querySelectorAll('.station');
			const masterBtn = document.querySelector('.master-play-btn');
			const masterPlayIcon = masterBtn.querySelector('.fa-play');
			const masterPauseIcon = masterBtn.querySelector('.fa-pause');

			const volumeSlider = document.getElementById('volumeSlider');
			const volumeFill = document.getElementById('volumeFill');
			const volumeMuteBtn = document.querySelector('.volume-mute-btn');
			const unmuteIcon = volumeMuteBtn.querySelector('.fa-volume-up');
			const muteIcon = volumeMuteBtn.querySelector('.fa-volume-mute');
			const metaStationLogoElement = document.getElementById('metaStationLogo');


			// Initialize volume slider display
			volumeFill.style.width = `${prevVolume * 100}%`;

			// --- Master Play/Pause Control ---
			masterBtn.addEventListener('click', () => {
				if (currentRadio) {
					if (currentRadio.playing()) {
						currentRadio.pause();
					} else {
						currentRadio.play();
					}
				} else if (stationElements.length > 0) {
					playStation(stationElements[0]);
				}
			});

			// --- Station Controls ---
			stationElements.forEach(stationEl => {
				const btn = stationEl.querySelector('.station-play-btn');
				stationEl.addEventListener('click', (e) => {
					if (e.target.closest('.station-play-btn') && currentStationElement === stationEl) {
						if (currentRadio && currentRadio.playing()) currentRadio.pause();
						else if (currentRadio) currentRadio.play();
						return;
					}
					if (currentStationElement !== stationEl) {
						playStation(stationEl);
					} else if (currentRadio && !currentRadio.playing()) {
						currentRadio.play();
					}
				});

				btn.addEventListener('click', (e) => {
					e.stopPropagation();
					if (currentStationElement !== stationEl) {
						playStation(stationEl);
					} else {
						if (currentRadio.playing()) {
							currentRadio.pause();
						} else {
							currentRadio.play();
						}
					}
				});
			});

			// --- Volume Slider Control ---
			let isDraggingVolume = false;
			volumeSlider.addEventListener('mousedown', (e) => {
				isDraggingVolume = true;
				updateVolumeOnDrag(e);
			});
			document.addEventListener('mousemove', (e) => {
				if (isDraggingVolume) updateVolumeOnDrag(e);
			});
			document.addEventListener('mouseup', () => {
				if (isDraggingVolume) isDraggingVolume = false;
			});
			volumeSlider.addEventListener('click', updateVolumeOnDrag);

			function updateVolumeOnDrag(e) {
				const rect = volumeSlider.getBoundingClientRect();
				let volume = (e.clientX - rect.left) / rect.width;
				volume = Math.max(0, Math.min(1, volume));
				setVolume(volume);
				if (isMuted && volume > 0) {
					toggleMute(false);
				}
			}

			function setVolume(volume) {
				prevVolume = volume;
				volumeFill.style.width = `${volume * 100}%`;
				if (currentRadio) {
					currentRadio.volume(isMuted ? 0 : volume);
				}
				if (volume === 0 && !isMuted) {
					unmuteIcon.style.display = 'none';
					muteIcon.style.display = 'inline-block';
				} else if (volume > 0 && !isMuted) {
					unmuteIcon.style.display = 'inline-block';
					muteIcon.style.display = 'none';
				}
			}

			// --- Mute Control ---
			volumeMuteBtn.addEventListener('click', () => {
				toggleMute(!isMuted);
			});

			function toggleMute(shouldMute) {
				isMuted = shouldMute;
				muteIcon.style.display = isMuted ? 'inline-block' : 'none';
				unmuteIcon.style.display = isMuted ? 'none' : 'inline-block';

				if (currentRadio) {
					if (isMuted) {
						currentRadio.volume(0);
						volumeFill.style.width = '0%';
					} else {
						currentRadio.volume(prevVolume);
						volumeFill.style.width = `${prevVolume * 100}%`;
						if (prevVolume === 0) {
							unmuteIcon.style.display = 'none';
							muteIcon.style.display = 'inline-block';
						}
					}
				} else {
					volumeFill.style.width = isMuted ? '0%' : `${prevVolume * 100}%`;
				}
			}

			// --- Initialize Audio Visualizer ---
			function initVisualizer() {
				console.log('Initializing visualizer...');
				if (!Howler.ctx) {
					console.error('Howler audio context (Howler.ctx) not available.');
					Howler.autoUnlock = true;
					if (!currentRadio || !currentRadio.playing()) {
						const dummySound = new Howl({ src: ['data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'], volume: 0 });
						dummySound.play();
						dummySound.once('play', () => {
							dummySound.stop();
							if (!Howler.ctx) {
								console.error('Still no Howler.ctx after dummy play.');
								return;
							}
							console.log('Howler.ctx initialized after dummy play.');
							setupAnalyserNodes();
						});
						return;
					}
				}
				setupAnalyserNodes();
			}

			function setupAnalyserNodes() {
				if (!Howler.ctx) {
					console.error('Cannot setup analyser, Howler.ctx is null.');
					return;
				}
				if (!analyser) {
					analyser = Howler.ctx.createAnalyser();
					analyser.fftSize = 256;
					dataArray = new Uint8Array(analyser.frequencyBinCount);
					console.log('Created new AnalyserNode:', analyser);
				}
				if (Howler.masterGain.numberOfOutputs > 0) {
					Howler.masterGain.disconnect();
				}
				Howler.masterGain.connect(analyser);
				analyser.connect(Howler.ctx.destination);
				console.log('Audio nodes connected: Howler.masterGain -> AnalyserNode -> Destination');

				if (!canvasContext) {
					canvasContext = visualizer.getContext('2d');
					resizeCanvas();
					console.log('Canvas context created. Dimensions:', visualizer.width, visualizer.height);
				}

				if (currentRadio && !currentRadio._visualizing) {
					currentRadio._visualizing = true;
					console.log('Starting visualization loop for current radio.');
					drawVisualizer();
				}
			}

			// --- Play Station Function ---
			function playStation(stationEl) {
				const stationURL = stationEl.dataset.url;
				console.log('Attempting to play station:', stationURL);

				if (currentRadio) {
					console.log('Stopping previous radio.');
					currentRadio.stop();
					if (currentRadio._visualizing) {
						currentRadio._visualizing = false;
					}
				}

				updateMasterPlayPauseIcons(false);
				if (currentStationElement) {
					updateStationPlayPauseIcons(currentStationElement, false);
				}

				currentRadio = new Howl({
					src: [stationURL],
					html5: true,
					format: ['mp3', 'aac'],
					volume: isMuted ? 0 : prevVolume,
					onplay: function () {
						console.log('Playback started for:', stationURL);
						if (Howler.ctx.state === 'suspended') {
							console.log('AudioContext is suspended, attempting to resume...');
							Howler.ctx.resume().then(() => {
								console.log('AudioContext resumed successfully.');
								initVisualizer();
							}).catch(e => console.error('Error resuming AudioContext:', e));
						} else {
							initVisualizer();
						}
						updateMasterPlayPauseIcons(true);
						updateStationPlayPauseIcons(stationEl, true);
						updateMetadata(stationEl);
					},
					onpause: function () {
						console.log('Playback paused for:', stationURL);
						updateMasterPlayPauseIcons(false);
						updateStationPlayPauseIcons(stationEl, false);
						if (canvasContext) {
							canvasContext.clearRect(0, 0, visualizer.width, visualizer.height);
						}
					},
					onstop: function () {
						console.log('Playback stopped for:', stationURL);
						if (this._visualizing) {
							this._visualizing = false;
						}
						updateMasterPlayPauseIcons(false);
						updateStationPlayPauseIcons(stationEl, false);
						if (canvasContext) {
							canvasContext.clearRect(0, 0, visualizer.width, visualizer.height);
						}
						if (currentRadio === this) {
							resetMetadataToDefault();
							currentRadio = null;
							currentStationElement = null;
						}
					},
					onloaderror: function (soundId, error) {
						console.error('Error loading station:', stationURL, 'Error Code:', error);
						let message = 'Error loading: ' + stationEl.querySelector('.stationName').textContent;
						if (error === 2) { // xhr_status
							message += ' (Network or stream access issue)';
						} else if (error === 4) { // src_not_supported
							message += ' (Format not supported or stream issue)';
						}
						displayMessage(message, true);

						if (currentRadio === this) {
							updateMasterPlayPauseIcons(false);
							updateStationPlayPauseIcons(stationEl, false);
							resetMetadataToDefault();
							currentRadio = null;
							currentStationElement = null;
						}
					},
					onplayerror: function (soundId, error) {
						console.error('Error playing station:', stationURL, 'Error:', error);
						displayMessage('Error playing: ' + stationEl.querySelector('.stationName').textContent, true);
						if (Howler.ctx.state === 'suspended') {
							displayMessage('Audio may be blocked. Click to enable.', false);
						}
						if (currentRadio === this) {
							updateMasterPlayPauseIcons(false);
							updateStationPlayPauseIcons(stationEl, false);
							resetMetadataToDefault();
							currentRadio = null;
							currentStationElement = null;
						}
					},
					onend: function () {
						console.log('Stream ended for:', stationURL);
						if (this._visualizing) {
							this._visualizing = false;
						}
						updateMasterPlayPauseIcons(false);
						updateStationPlayPauseIcons(stationEl, false);
						if (currentRadio === this) {
							resetMetadataToDefault();
							currentRadio = null;
							currentStationElement = null;
						}
					}
				});

				currentRadio.play();
				currentStationElement = stationEl;
			}

			function displayMessage(message, isError) {
				const tempMessageDisplay = document.getElementById('temporaryMessage');
				if (!tempMessageDisplay) {
					console.warn("Temporary message display element not found.");
					return;
				}

				tempMessageDisplay.textContent = message;
				tempMessageDisplay.style.color = isError ? '#ff8a80' : '#b9f6ca';
				tempMessageDisplay.style.backgroundColor = isError ? '#c62828' : '#2e7d32';
				tempMessageDisplay.style.display = 'block';
				tempMessageDisplay.style.opacity = '1';


				setTimeout(() => {
					tempMessageDisplay.style.opacity = '0';
					setTimeout(() => {
						tempMessageDisplay.style.display = 'none';
						tempMessageDisplay.textContent = '';
					}, 300);
				}, 2700);
			}

			// --- Draw Visualizer Function ---
			function drawVisualizer() {
				if (!analyser || !currentRadio || !currentRadio.playing() || !currentRadio._visualizing) {
					return;
				}
				analyser.getByteFrequencyData(dataArray);
				// console.log(dataArray); 

				if (!canvasContext) return;
				canvasContext.clearRect(0, 0, visualizer.width, visualizer.height);

				const barWidth = (visualizer.width / dataArray.length) * 1.5;
				let barHeight;
				let x = 0;
				canvasContext.fillStyle = '#4CAF50';

				for (let i = 0; i < dataArray.length; i++) {
					barHeight = (dataArray[i] / 255) * visualizer.height * 0.8;
					canvasContext.fillRect(x, visualizer.height - barHeight, barWidth, barHeight);
					x += barWidth + 1;
				}
				requestAnimationFrame(drawVisualizer);
			}

			// --- UI Update Functions ---
			function updateMasterPlayPauseIcons(isPlaying) {
				masterPlayIcon.style.display = isPlaying ? 'none' : 'inline-block';
				masterPauseIcon.style.display = isPlaying ? 'inline-block' : 'none';
			}

			function updateStationPlayPauseIcons(stationEl, isPlaying) {
				if (stationEl) {
					const playIcon = stationEl.querySelector('.fa-play');
					const pauseIcon = stationEl.querySelector('.fa-pause');
					if (playIcon && pauseIcon) {
						playIcon.style.display = isPlaying ? 'none' : 'inline-block';
						pauseIcon.style.display = isPlaying ? 'inline-block' : 'none';
					}
				}
				stationElements.forEach(el => {
					if (el !== stationEl) {
						const pI = el.querySelector('.fa-play');
						const psI = el.querySelector('.fa-pause');
						if (pI) pI.style.display = 'inline-block';
						if (psI) psI.style.display = 'none';
					}
				});
			}

			function resetMetadataToDefault() {
				document.querySelector('.stationMeta').textContent = "Select a Station";
				document.querySelector('.locationMeta').textContent = "---";
				if (metaStationLogoElement) {
					metaStationLogoElement.src = 'https://placehold.co/60x60/333/ccc?text=Radio';
					metaStationLogoElement.alt = 'Station Logo';
					metaStationLogoElement.onerror = function () {
						this.onerror = null;
						this.src = 'https://placehold.co/60x60/333/ccc?text=Error';
						this.alt = 'Logo Error';
					};
				}
			}

			function updateMetadata(stationEl) {
				if (!stationEl) {
					resetMetadataToDefault();
					return;
				}
				const logoSrc = stationEl.querySelector('.station-logo')?.src;

				if (metaStationLogoElement && logoSrc) {
					metaStationLogoElement.src = logoSrc;
					metaStationLogoElement.alt = stationEl.querySelector('.stationName').textContent + " Logo";
					metaStationLogoElement.onerror = function () {
						this.onerror = null;
						this.src = 'https://placehold.co/60x60/2c2c2c/aaa?text=N/A';
						this.alt = 'Logo not available';
					};
				} else if (metaStationLogoElement) {
					metaStationLogoElement.src = 'https://placehold.co/60x60/333/ccc?text=Radio';
					metaStationLogoElement.alt = 'Station Logo';
					metaStationLogoElement.onerror = function () { this.onerror = null; this.src = 'https://placehold.co/60x60/333/ccc?text=Error'; this.alt = 'Logo Error'; };
				}

				document.querySelector('.stationMeta').textContent = stationEl.querySelector('.stationName').textContent;
				document.querySelector('.locationMeta').textContent = stationEl.querySelector('.stationLocation').textContent;
			}

			// --- Canvas Resize Handling ---
			function resizeCanvas() {
				if (visualizer) {
					visualizer.width = visualizer.offsetWidth;
					visualizer.height = visualizer.offsetHeight;
					if (canvasContext) {
						console.log('Canvas resized to:', visualizer.width, 'x', visualizer.height);
					}
				}
			}
			window.addEventListener('resize', resizeCanvas);

			// Initial setup
			resizeCanvas();
			setVolume(prevVolume);
			resetMetadataToDefault();

			function initialUserInteractionUnlock() {
				if (Howler.ctx && Howler.ctx.state === 'suspended') {
					Howler.ctx.resume().then(() => {
						console.log('AudioContext resumed by initial user interaction.');
					}).catch(e => console.error('Error resuming AudioContext on initial interaction:', e));
				}
				document.body.removeEventListener('click', initialUserInteractionUnlock);
				document.body.removeEventListener('touchstart', initialUserInteractionUnlock);
			}
			document.body.addEventListener('click', initialUserInteractionUnlock);
			document.body.addEventListener('touchstart', initialUserInteractionUnlock);

		});