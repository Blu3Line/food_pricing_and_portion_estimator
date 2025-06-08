/**
 * Kamera İşlevselliği Modülü - Electron Versiyonu
 * WebSocket entegrasyonu ile güncellendi
 */
const CameraModule = (function() {
    // Özel değişkenler
    let photoVideo = null;
    let realtimeVideo = null;
    let photoCanvas = null;
    let resultImage = null;
    let uploadedImage = null;
    let photoStreaming = false;
    let realtimeStreaming = false;
    let imageAnalysisCallback = null;
    let currentTab = 'photo'; // 'photo', 'upload', 'realtime'
    let fileInput = null;
    let currentConstraints = {}; // Kamera kısıtlamaları
    let websocketEnabled = false; // WebSocket entegrasyonu aktif mi?
    let realtimeProcessing = false; // Gerçek zamanlı işlem devam ediyor mu?
    let realtimeAnalysisInterval = null; // Gerçek zamanlı analiz zamanlayıcısı
    let realtimeStreamController = null; // WebSocket stream controller
    let detectionFrozen = false; // Tespit kilitleme durumu
    let lastDetectionResult = null; // Son tespit sonucu (kilitleme için)
    let frozenFrameData = null; // Donmuş video karesi verisi

    /**
     * Modülü başlatır ve gerekli DOM elementlerini yapılandırır
     * @param {Function} onImageAnalysis - Resim analizi için callback fonksiyonu
     * @returns {boolean} - Başlatma başarılı mı?
     */
    const init = async (onImageAnalysis = null) => {
        // TabsModule'ün varlığını kontrol et
        if (typeof TabsModule === 'undefined') {
            console.error('CameraModule requires TabsModule to be available');
            return false;
        }
        
        // VisualizationModule'ün varlığını kontrol et
        if (typeof VisualizationModule === 'undefined') {
            console.error('CameraModule requires VisualizationModule to be available');
            return false;
        }

        // Gerekli DOM elementlerini tanımla ve kontrol et
        const requiredElements = [
            { id: 'photoVideo', variable: 'photoVideo', critical: true },
            { id: 'realtimeVideo', variable: 'realtimeVideo', critical: true },
            { id: 'photoCanvas', variable: 'photoCanvas', critical: true },
            { id: 'resultImage', variable: 'resultImage', critical: true },
            { id: 'uploadedImage', variable: 'uploadedImage', critical: false },
            { id: 'fileInput', variable: 'fileInput', critical: false },
            { id: 'takePhotoTab', variable: null, critical: true },
            { id: 'uploadImageTab', variable: null, critical: true },
            { id: 'realTimeTab', variable: null, critical: true },
            { id: 'photoTabContent', variable: null, critical: true },
            { id: 'uploadTabContent', variable: null, critical: true },
            { id: 'realtimeTabContent', variable: null, critical: true },
            { id: 'resultSection', variable: null, critical: true }
        ];

        // Elementlerin varlığını kontrol et
        let missingCriticalElements = false;
        const missingElements = [];

        for (const element of requiredElements) {
            const domElement = document.getElementById(element.id);
            
            if (!domElement) {
                missingElements.push(element.id);
                if (element.critical) {
                    missingCriticalElements = true;
                    console.error(`Kritik DOM elementi eksik: #${element.id}`);
                } else {
                    console.warn(`İsteğe bağlı DOM elementi eksik: #${element.id}`);
                }
            } else if (element.variable) {
                // Global değişkene ata
                window[element.variable] = domElement;
            }
        }

        // Kritik elementler eksikse modülü başlatma
        if (missingCriticalElements) {
            console.error('Kamera modülü başlatılamadı: Kritik DOM elementleri eksik:', 
                missingElements.filter(id => 
                    requiredElements.find(el => el.id === id).critical
                )
            );
            return false;
        }

        // DOM elementlerini seç
        photoVideo = document.getElementById('photoVideo');
        realtimeVideo = document.getElementById('realtimeVideo');
        photoCanvas = document.getElementById('photoCanvas');
        resultImage = document.getElementById('resultImage');
        uploadedImage = document.getElementById('uploadedImage');
        fileInput = document.getElementById('fileInput');
        
        // Callback fonksiyonunu kaydet
        imageAnalysisCallback = onImageAnalysis;

        // Event dinleyicilerini ekle
        setupEventListeners();

        // Başlangıçta varsayılan sekmeyi aktifleştir - TabsModule kullanarak
        TabsModule.switchCameraTab('photo', {
            onTabChange: (tabId) => {
                currentTab = tabId;
            }
        });

        // WebSocket entegrasyonunu kontrol et
        websocketEnabled = typeof WebSocketManager !== 'undefined';
        

        // Kamera listesini yükle (hem Electron hem tarayıcı ortamı için)
        try {
            await loadAvailableCameras();
        } catch (error) {
            console.error('Kamera listesi yüklenirken hata oluştu:', error);
        }
        
        return true;
    };

    /**
     * Kullanılabilir kameraları yükler
     */
    const loadAvailableCameras = async () => {
        try {
            // MediaDevices API'sini kullanarak cihazları listele
            if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(device => device.kind === 'videoinput');
                
                console.log('Kullanılabilir kameralar:', videoDevices);
                
                // Kamera seçim dropdown'ını güncelle
                const cameraSelect = document.getElementById('cameraSelect');
                if (cameraSelect) {
                    // Mevcut seçenekleri temizle (varsayılan hariç)
                    while (cameraSelect.children.length > 1) {
                        cameraSelect.removeChild(cameraSelect.lastChild);
                    }
                    
                    // Kameraları dropdown'a ekle
                    videoDevices.forEach((device, index) => {
                        const option = document.createElement('option');
                        option.value = device.deviceId;
                        // Label yoksa generic isim ver
                        option.textContent = device.label || `Kamera ${index + 1}`;
                        cameraSelect.appendChild(option);
                    });
                    
                    // Eğer hiç kamera yoksa bilgi ver
                    if (videoDevices.length === 0) {
                        const option = document.createElement('option');
                        option.value = "";
                        option.textContent = "Kamera bulunamadı";
                        option.disabled = true;
                        cameraSelect.appendChild(option);
                    }
                }
            } else {
                console.warn('MediaDevices API desteklenmiyor');
            }
        } catch (error) {
            console.error('Kamera listesi alınırken hata:', error);
            
            // Kamera erişimi için izin istememiz gerekebilir
            if (error.name === 'NotAllowedError') {
                console.log('Kamera izni gerekli - önce izin istenerek tekrar denenecek');
                try {
                    // Geçici olarak kullanıcı medyasına erişim iste (sadece listelemek için)
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    // İzin alındıktan sonra stream'i durdur
                    stream.getTracks().forEach(track => track.stop());
                    
                    // İzin alındıktan sonra tekrar dene
                    setTimeout(() => loadAvailableCameras(), 1000);
                } catch (permissionError) {
                    console.error('Kamera izni alınamadı:', permissionError);
                }
            }
        }
    };

    /**
     * Belirli bir kamera aygıtını seçer
     * @param {string} deviceId - Kamera aygıt ID'si
     */
    const selectCamera = (deviceId) => {
        if (deviceId && deviceId.trim() !== '') {
            currentConstraints = { 
                video: { 
                    deviceId: { exact: deviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false 
            };
            console.log('Kamera seçildi:', deviceId);
        } else {
            // Varsayılan kamera
            currentConstraints = { 
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }, 
                audio: false 
            };
            console.log('Varsayılan kamera seçildi');
        }
    };

    /**
     * Event dinleyicilerini ayarlar
     */
    const setupEventListeners = () => {
        // Tab butonları
        const takePhotoTab = document.getElementById('takePhotoTab');
        const uploadImageTab = document.getElementById('uploadImageTab');
        const realTimeTab = document.getElementById('realTimeTab');
        
        // Fotoğraf çekme modu butonları
        const startPhotoCamera = document.getElementById('startPhotoCamera');
        const stopPhotoCamera = document.getElementById('stopPhotoCamera');
        const capturePhotoBtn = document.getElementById('capturePhotoBtn');
        
        // Resim yükleme modu butonları
        const chooseFileBtn = document.getElementById('chooseFileBtn');
        
        // Gerçek zamanlı mod butonları
        const startRealtimeBtn = document.getElementById('startRealtimeBtn');
        const stopRealtimeBtn = document.getElementById('stopRealtimeBtn');
        
        // Sonuç bölümü butonları
        const backToCamera = document.getElementById('backToCamera');
        const analyzePhotoBtn = document.getElementById('analyzePhotoBtn');
        
        // Tab butonları için TabsModule kullanarak event listeners
        if (takePhotoTab) {
            takePhotoTab.addEventListener('click', () => {
                TabsModule.switchCameraTab('photo', {
                    onPhotoStreamStop: photoStreaming ? stopPhotoMode : null,
                    onRealtimeStreamStop: realtimeStreaming ? stopRealtimeMode : null,
                    onTabChange: (tabId) => {
                        currentTab = tabId;
                    }
                });
            });
        }
        
        if (uploadImageTab) {
            uploadImageTab.addEventListener('click', () => {
                TabsModule.switchCameraTab('upload', {
                    onPhotoStreamStop: photoStreaming ? stopPhotoMode : null,
                    onRealtimeStreamStop: realtimeStreaming ? stopRealtimeMode : null,
                    onTabChange: (tabId) => {
                        currentTab = tabId;
                    }
                });
            });
        }
        
        if (realTimeTab) {
            realTimeTab.addEventListener('click', () => {
                TabsModule.switchCameraTab('realtime', {
                    onPhotoStreamStop: photoStreaming ? stopPhotoMode : null,
                    onRealtimeStreamStop: realtimeStreaming ? stopRealtimeMode : null, 
                    onTabChange: (tabId) => {
                        currentTab = tabId;
                    }
                });
            });
        }

        // Fotoğraf çekme modu butonları için event listeners
        if (startPhotoCamera) {
            startPhotoCamera.addEventListener('click', startPhotoMode);
        }
        
        if (stopPhotoCamera) {
            stopPhotoCamera.addEventListener('click', stopPhotoMode);
        }
        
        if (capturePhotoBtn) {
            capturePhotoBtn.addEventListener('click', capturePhoto);
        }
        
        // Resim yükleme modu butonları için event listeners
        if (chooseFileBtn) {
            chooseFileBtn.addEventListener('click', () => {
                // Electron ortamında dosya seçici kullan
                if (window.electronAPI && window.electronAPI.openImage) {
                    window.electronAPI.openImage()
                        .then(result => {
                            if (result.success) {
                                handleElectronImage(result.data, result.filePath);
                            }
                        })
                        .catch(error => {
                            console.error('Resim yükleme hatası:', error);
                        });
                } else if (fileInput) {
                    // Tarayıcı ortamında normal file input kullan
                    fileInput.click();
                }
            });
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', handleFileSelect);
            
            // Sürükle bırak için event listeners
            const uploadCameraView = document.getElementById('uploadCameraView');
            if (uploadCameraView) {
                uploadCameraView.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    uploadCameraView.classList.add('drag-over');
                });
                
                uploadCameraView.addEventListener('dragleave', () => {
                    uploadCameraView.classList.remove('drag-over');
                });
                
                uploadCameraView.addEventListener('drop', (e) => {
                    e.preventDefault();
                    uploadCameraView.classList.remove('drag-over');
                    
                    if (e.dataTransfer.files.length) {
                        handleFiles(e.dataTransfer.files);
                    }
                });
                
                const uploadPlaceholder = document.getElementById('uploadPlaceholder');
                if (uploadPlaceholder) {
                    uploadPlaceholder.addEventListener('click', () => {
                        if (window.electronAPI && window.electronAPI.openImage) {
                            window.electronAPI.openImage()
                                .then(result => {
                                    if (result.success) {
                                        handleElectronImage(result.data, result.filePath);
                                    }
                                })
                                .catch(error => {
                                    console.error('Resim yükleme hatası:', error);
                                });
                        } else if (fileInput) {
                            fileInput.click();
                        }
                    });
                }
            }
        }
        
        // Gerçek zamanlı mod butonları için event listeners
        if (startRealtimeBtn) {
            startRealtimeBtn.addEventListener('click', startRealtimeMode);
        }
        
        if (stopRealtimeBtn) {
            stopRealtimeBtn.addEventListener('click', stopRealtimeMode);
        }
        
        // Tespit kilitleme butonu için event listener
        const freezeDetectionBtn = document.getElementById('freezeDetectionBtn');
        if (freezeDetectionBtn) {
            freezeDetectionBtn.addEventListener('click', toggleDetectionFreeze);
        }
        
        // Sonuç bölümü butonları için event listeners
        if (backToCamera) {
            backToCamera.addEventListener('click', () => {
                TabsModule.showCameraTab(currentTab);
                TabsModule.hideCameraResult();
            });
        }
        
        if (analyzePhotoBtn) {
            analyzePhotoBtn.addEventListener('click', analyzePhoto);
        }
        
        // Confidence slider (artık ConfidenceSliderModule tarafından yönetiliyor, kaldırıldı)
        
        // Kamera seçici dropdown
        const cameraSelect = document.getElementById('cameraSelect');
        if (cameraSelect) {
            cameraSelect.addEventListener('change', (e) => {
                const selectedCameraId = e.target.value;
                console.log('Seçilen kamera ID:', selectedCameraId);
                selectCamera(selectedCameraId);
                
                // Eğer kamera çalışıyorsa yeniden başlat
                if (photoStreaming) {
                    stopPhotoMode();
                    setTimeout(() => {
                        startPhotoMode();
                    }, 500);
                }
                
                if (realtimeStreaming) {
                    stopRealtimeMode();
                    setTimeout(() => {
                        startRealtimeMode();
                    }, 500);
                }
            });
        }
    };


    // Tab fonksiyonları artık TabsModule içinde tanımlandı (BU YORUM SATIRI SİLİNMESİN KALSIN)
    

    /**
     * Fotoğraf modunu başlatır
     */
    const startPhotoMode = async () => {
        if (photoStreaming) return;
        
        try {
            // Kamera kısıtlamalarını belirle
            const constraints = currentConstraints.video 
                ? currentConstraints 
                : { video: true, audio: false };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            photoVideo.srcObject = stream;
            photoVideo.style.display = 'block';
            photoVideo.play();
            photoStreaming = true;
            
            // Arayüz elementlerini güncelle
            document.querySelector('#photoCameraView .camera-placeholder').style.display = 'none';
            document.getElementById('startPhotoCamera').style.display = 'none';
            document.getElementById('stopPhotoCamera').style.display = 'inline-flex';
            document.getElementById('capturePhotoBtn').style.display = 'inline-flex';
        } catch (err) {
            console.error("Kamera erişim hatası: ", err);
            
            // Electron ortamında daha spesifik hata mesajı göster
            if (window.environment && window.environment.isElectron) {
                const errorMessage = err.name === 'NotAllowedError' 
                    ? "Kamera erişimine izin verilmedi. Lütfen sistem ayarlarından kamera izinlerini kontrol edin."
                    : (err.name === 'NotFoundError' 
                        ? "Kamera cihazı bulunamadı. Lütfen bir kamera bağlı olduğundan emin olun."
                        : "Kameraya erişilirken bir hata oluştu. Lütfen kamera bağlantısını kontrol edin.");
                        
                alert(errorMessage);
            } else {
                alert("Kameraya erişilemedi. Lütfen kamera erişim izinlerini kontrol edin.");
            }
        }
    };
    
    /**
     * Fotoğraf modunu durdurur
     */
    const stopPhotoMode = () => {
        if (!photoStreaming || !photoVideo.srcObject) return;
        
        try {
            const stream = photoVideo.srcObject;
            const tracks = stream.getTracks();
            
            tracks.forEach(track => track.stop());
            photoVideo.srcObject = null;
            photoVideo.style.display = 'none';
            photoStreaming = false;
            
            // Arayüz elementlerini güncelle
            document.querySelector('#photoCameraView .camera-placeholder').style.display = 'flex';
            document.getElementById('startPhotoCamera').style.display = 'inline-flex';
            document.getElementById('stopPhotoCamera').style.display = 'none';
            document.getElementById('capturePhotoBtn').style.display = 'none';
        } catch (err) {
            console.error("Kamera durdurma hatası: ", err);
        }
    };
    
    /**
     * Fotoğraf çeker
     */
    const capturePhoto = () => {
        if (!photoStreaming) return;
        
        const width = photoVideo.videoWidth;
        const height = photoVideo.videoHeight;
        
        if (width && height) {
            photoCanvas.width = width;
            photoCanvas.height = height;
            
            const context = photoCanvas.getContext('2d');
            context.drawImage(photoVideo, 0, 0, width, height);
            
            const dataUrl = photoCanvas.toDataURL('image/png');
            
            // Kamerayı durdur
            stopPhotoMode();
            
            // Sonuç görüntüsünü ayarla
            resultImage.src = dataUrl;
            
            // Electron ortamında, resmi kaydetme seçeneği ekle
            if (window.environment && window.environment.isElectron) {
                // Burada bir "resmi kaydet" butonu eklenebilir
                // Şimdilik sadece sonuç bölümünü gösterelim
            }
            
            // Sonuç bölümünü göster
            TabsModule.showCameraResult();
        }
    };
    
    /**
     * Tespit kilitleme durumunu toggle eder
     */
    const toggleDetectionFreeze = () => {
        detectionFrozen = !detectionFrozen;
        const freezeBtn = document.getElementById('freezeDetectionBtn');
        
        if (detectionFrozen) {
            // Tespiti kilitle - mevcut video karesini yakala
            captureFrozenFrame();
            freezeBtn.innerHTML = '<i class="fas fa-unlock"></i> Tespiti Serbest Bırak';
            freezeBtn.classList.remove('btn-warning');
            freezeBtn.classList.add('btn-info');
            console.log('🔒 Tespit ve video karesi kilitlendi');
        } else {
            // Tespiti serbest bırak
            freezeBtn.innerHTML = '<i class="fas fa-lock"></i> Tespiti Kilitle';
            freezeBtn.classList.remove('btn-info');
            freezeBtn.classList.add('btn-warning');
            lastDetectionResult = null; // Cache'i temizle
            frozenFrameData = null; // Donmuş kareyi temizle
            console.log('🔓 Tespit ve video serbest bırakıldı');
        }
    };

    /**
     * Mevcut video karesini yakalar ve saklar
     */
    const captureFrozenFrame = () => {
        if (!realtimeStreaming || !realtimeVideo) return;
        
        try {
            // Geçici canvas oluştur
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = realtimeVideo.videoWidth;
            tempCanvas.height = realtimeVideo.videoHeight;
            
            const context = tempCanvas.getContext('2d');
            context.drawImage(realtimeVideo, 0, 0, tempCanvas.width, tempCanvas.height);
            
            // Kare verisini sakla
            frozenFrameData = {
                imageData: context.getImageData(0, 0, tempCanvas.width, tempCanvas.height),
                width: tempCanvas.width,
                height: tempCanvas.height
            };
            
            console.log('📸 Video karesi donduruldu');
        } catch (error) {
            console.error('Video karesi yakalama hatası:', error);
        }
    };

    /**
     * Gerçek zamanlı modu başlatır
     */
    const startRealtimeMode = async () => {
        if (realtimeStreaming) return;
        
        try {
            // Kamera kısıtlamalarını belirle
            const constraints = currentConstraints.video 
                ? currentConstraints 
                : { video: true, audio: false };
                
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            realtimeVideo.srcObject = stream;
            realtimeVideo.style.display = 'block';
            realtimeVideo.play();
            realtimeStreaming = true;
            
            // Arayüz elementlerini güncelle
            document.getElementById('realtimePlaceholder').style.display = 'none';
            document.getElementById('startRealtimeBtn').style.display = 'none';
            document.getElementById('stopRealtimeBtn').style.display = 'inline-flex';
            document.getElementById('freezeDetectionBtn').style.display = 'inline-flex';
            
            // Sonuç görüntüleme alanını göster
            const resultSection = document.getElementById('realtimeDetectionResult');
            if (resultSection) {
                resultSection.style.display = 'block';
            }
            
            // Tespit sonuç canvas'ını hazırla
            const resultCanvas = document.getElementById('detectionResultCanvas');
            if (resultCanvas) {
                // Canvas boyutlarını ayarla - varsayılanı kullan, gerekirse video boyutlarına göre ayarlanabilir
                if (VisualizationModule && typeof VisualizationModule.setCanvasSize === 'function') {
                    VisualizationModule.setCanvasSize(resultCanvas, 320, 240);
                }
            }
            
            // Gerçek zamanlı analiz başlat
            startRealtimeAnalysis();
        } catch (err) {
            console.error("Kamera erişim hatası: ", err);
            
            // Electron ortamında daha spesifik hata mesajı göster
            if (window.environment && window.environment.isElectron) {
                const errorMessage = err.name === 'NotAllowedError' 
                    ? "Kamera erişimine izin verilmedi. Lütfen sistem ayarlarından kamera izinlerini kontrol edin."
                    : (err.name === 'NotFoundError' 
                        ? "Kamera cihazı bulunamadı. Lütfen bir kamera bağlı olduğundan emin olun."
                        : "Kameraya erişilirken bir hata oluştu. Lütfen kamera bağlantısını kontrol edin.");
                        
                alert(errorMessage);
            } else {
                alert("Kameraya erişilemedi. Lütfen kamera erişim izinlerini kontrol edin.");
            }
        }
    };
    
    /**
     * Gerçek zamanlı modu durdurur
     */
    const stopRealtimeMode = () => {
        if (!realtimeStreaming) return;
        
        try {
            const stream = realtimeVideo.srcObject;
            const tracks = stream.getTracks();
            
            tracks.forEach(track => track.stop());
            realtimeVideo.srcObject = null;
            realtimeVideo.style.display = 'none';
            realtimeStreaming = false;
            
            // Arayüz elementlerini güncelle
            document.getElementById('realtimePlaceholder').style.display = 'flex';
            document.getElementById('startRealtimeBtn').style.display = 'inline-flex';
            document.getElementById('stopRealtimeBtn').style.display = 'none';
            document.getElementById('freezeDetectionBtn').style.display = 'none';
            
            // Freeze state'ini resetle
            detectionFrozen = false;
            lastDetectionResult = null;
            frozenFrameData = null;
            const freezeBtn = document.getElementById('freezeDetectionBtn');
            if (freezeBtn) {
                freezeBtn.innerHTML = '<i class="fas fa-lock"></i> Tespiti Kilitle';
                freezeBtn.classList.remove('btn-info');
                freezeBtn.classList.add('btn-warning');
            }
            
            // Sonuç görüntüleme alanını gizle
            const resultSection = document.getElementById('realtimeDetectionResult');
            if (resultSection) {
                resultSection.style.display = 'none';
            }
            
            // Gerçek zamanlı analiz durdur
            stopRealtimeAnalysis();
        } catch (err) {
            console.error("Kamera durdurma hatası: ", err);
        }
    };
    
    /**
     * Electron aracılığıyla yüklenen resmi işler
     * @param {string} imageData - Base64 formatında resim verisi
     * @param {string} filePath - Dosya yolu
     */
    const handleElectronImage = (imageData, filePath) => {
        // Yüklenmiş resmi göster
        uploadedImage.src = imageData;
        uploadedImage.style.display = 'block';
        document.getElementById('uploadPlaceholder').style.display = 'none';
        
        // Sonuç görüntüsünü de ayarla
        resultImage.src = imageData;
        
        // Dosya adını göster (isteğe bağlı)
        const fileNameParts = filePath.split(/[\\/]/);
        const fileName = fileNameParts[fileNameParts.length - 1];
        console.log(`Yüklenen dosya: ${fileName}`);
        
        // Sonuç bölümünü göster
        TabsModule.showCameraResult();
    };
    
    /**
     * Dosya seçim işleyicisi
     * @param {Event} e - Change event
     */
    const handleFileSelect = (e) => {
        if (e.target.files.length) {
            handleFiles(e.target.files);
        }
    };
    
    /**
     * Dosyaları işler
     * @param {FileList} files - İşlenecek dosyalar
     */
    const handleFiles = (files) => {
        const file = files[0];
        if (!file.type.match('image/jpeg|image/jpg|image/png')) {
            alert('Lütfen sadece PNG, JPG veya JPEG dosyası seçin.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            // Yüklenmiş resmi göster
            uploadedImage.src = e.target.result;
            uploadedImage.style.display = 'block';
            document.getElementById('uploadPlaceholder').style.display = 'none';
            
            // Sonuç görüntüsünü de ayarla
            resultImage.src = e.target.result;
            
            // Sonuç bölümünü göster
            TabsModule.showCameraResult();
        };
        
        reader.readAsDataURL(file);
    };
    
    /**
     * Fotoğrafı analiz eder
     */
    const analyzePhoto = async () => {
        // Yükleme göstergesi
        const detectedItemsEl = document.getElementById('detectedItems');
        if (detectedItemsEl) {
            detectedItemsEl.innerHTML = '<li class="loading-item"><div class="loading-spinner"></div> Yemekler tespit ediliyor...</li>';
        }
        
        // Orijinal görüntüyü saklayalım - çözüm için
        const originalImage = resultImage.src;
        
        // WebSocket bağlantısı var mı kontrol et
        if (websocketEnabled && WebSocketManager.isConnected()) {
            try {          
                const configToSend = { 
                    confidence: AppConfig.confidenceThreshold,
                    enablePortionCalculation: AppConfig.portionCalculationEnabled 
                };
                console.log('📋 Camera Module - Gönderilecek config:', configToSend);
                
                // Resim verilerini WebSocket üzerinden gönder
                const response = await WebSocketManager.sendImage(
                    resultImage.src, 
                    'image', 
                    configToSend
                );
                
                if (response.success) {
                    // Görüntünün üzerine tespitleri çiz - VisualizationModule kullan
                    await VisualizationModule.displayDetectionsOnImage(resultImage, response.data);
                    
                    // Sonuçları callback'e aktar
                    if (imageAnalysisCallback) {
                        imageAnalysisCallback(response);
                    }
                } else {
                    console.error('Yemek tespiti hatası:', response.error);
                    if (detectedItemsEl) {
                        detectedItemsEl.innerHTML = `<li class="error-item">Tespit hatası: ${response.error}</li>`;
                    }
                }
            } catch (error) {
                console.error('WebSocket ile yemek tespiti hatası:', error);
                if (detectedItemsEl) {
                    detectedItemsEl.innerHTML = '<li class="error-item">Tespit sırasında bir hata oluştu. Bağlantınızı kontrol edin.</li>';
                }
                

            }
        } else {
            // WebSocket bağlantısı yoksa hata göster
            console.error('WebSocket bağlantısı gerekli');
            if (detectedItemsEl) {
                detectedItemsEl.innerHTML = '<li class="error-item">WebSocket bağlantısı gerekli. Lütfen bağlantı durumunu kontrol edin.</li>';
            }
        }
    };
    

    
    /**
     * Görüntüyü kaydet (Electron ortamı için)
     */
    const saveImage = async () => {
        if (!resultImage.src) return;
        
        if (window.electronAPI && window.electronAPI.saveImage) {
            try {
                const result = await window.electronAPI.saveImage(resultImage.src);
                if (result.success) {
                    console.log(`Görüntü kaydedildi: ${result.filePath}`);
                }
            } catch (error) {
                console.error('Görüntü kaydetme hatası:', error);
                alert('Görüntü kaydedilirken bir hata oluştu.');
            }
        }
    };
    
    /**
     * Gerçek zamanlı analizi başlatır
     */
    const startRealtimeAnalysis = () => {
        if (realtimeAnalysisInterval) {
            clearInterval(realtimeAnalysisInterval);
            realtimeAnalysisInterval = null;
        }
        
        // WebSocket bağlantısı var mı ve WebSocketManager kullanılabilir mi kontrol et
        if (websocketEnabled && typeof WebSocketManager !== 'undefined' && WebSocketManager.isConnected()) {
            console.log('WebSocket ile gerçek zamanlı analiz başlatılıyor...');
            
            // WebSocketManager'ın webcam stream fonksiyonunu kullan
            realtimeStreamController = WebSocketManager.startWebcamStream(
                // Frame yakalama callback'i
                async () => {
                    if (!realtimeStreaming) return null;
                    
                    // Geçici canvas oluştur
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = realtimeVideo.videoWidth;
                    tempCanvas.height = realtimeVideo.videoHeight;
                    
                    const context = tempCanvas.getContext('2d');
                    context.drawImage(realtimeVideo, 0, 0, tempCanvas.width, tempCanvas.height);
                    
                    return tempCanvas.toDataURL('image/jpeg');
                },
                // Interval - ms cinsinden (daha akıcı olması için 200ms)
                200,
                // Konfigürasyon
                {
                    confidence: AppConfig.confidenceThreshold,
                    enablePortionCalculation: AppConfig.portionCalculationEnabled,
                    // Sonuç callback'i
                    onResult: (response) => {
                        // Eğer tespit kilitlenmişse yeni sonuçları işleme
                        if (detectionFrozen) {
                            // Kilitli durumda donmuş kareyi ve son sonucu kullan
                            if (lastDetectionResult && frozenFrameData) {
                                const detectionResultCanvas = document.getElementById('detectionResultCanvas');
                                if (detectionResultCanvas) {
                                    // Canvas boyutlarını ayarla
                                    if (detectionResultCanvas.width !== frozenFrameData.width || 
                                        detectionResultCanvas.height !== frozenFrameData.height) {
                                        detectionResultCanvas.width = frozenFrameData.width;
                                        detectionResultCanvas.height = frozenFrameData.height;
                                    }
                                    
                                    // Donmuş video karesini canvas'a çiz
                                    const ctx = detectionResultCanvas.getContext('2d');
                                    ctx.clearRect(0, 0, detectionResultCanvas.width, detectionResultCanvas.height);
                                    ctx.putImageData(frozenFrameData.imageData, 0, 0);
                                    
                                    // Kilitli tespitleri çiz
                                    VisualizationModule.renderDetections(detectionResultCanvas, lastDetectionResult.data);
                                }
                            }
                            return; // Kilitli durumda yeni işlem yapma
                        }
                        
                        // Normal durumda tespit sonuç canvas'ını güncelle
                        const detectionResultCanvas = document.getElementById('detectionResultCanvas');
                        if (detectionResultCanvas) {
                            if (response.success && response.data && response.data.length > 0) {
                                // Canvas boyutlarını ayarla (eğer video boyutları değiştiyse)
                                if (detectionResultCanvas.width !== realtimeVideo.videoWidth || 
                                    detectionResultCanvas.height !== realtimeVideo.videoHeight) {
                                    detectionResultCanvas.width = realtimeVideo.videoWidth;
                                    detectionResultCanvas.height = realtimeVideo.videoHeight;
                                }
                                
                                // Video karesini canvas'a çiz
                                const ctx = detectionResultCanvas.getContext('2d');
                                ctx.clearRect(0, 0, detectionResultCanvas.width, detectionResultCanvas.height);
                                ctx.drawImage(realtimeVideo, 0, 0, detectionResultCanvas.width, detectionResultCanvas.height);
                                
                                // VisualizationModule ile tespitleri çiz
                                VisualizationModule.renderDetections(detectionResultCanvas, response.data);
                                
                                // Son tespit sonucunu kaydet (kilitleme için)
                                lastDetectionResult = response;
                                
                                // Callback'i çağır
                                if (imageAnalysisCallback) {
                                    imageAnalysisCallback(response);
                                }
                            } else if (response.success) {
                                // Tespit yoksa sadece video karesini göster
                                const ctx = detectionResultCanvas.getContext('2d');
                                ctx.clearRect(0, 0, detectionResultCanvas.width, detectionResultCanvas.height);
                                ctx.drawImage(realtimeVideo, 0, 0, detectionResultCanvas.width, detectionResultCanvas.height);
                                
                                // Tespit bulunamadı mesajı göster
                                VisualizationModule.displayMessage(detectionResultCanvas, 'Tespit bulunamadı');
                            }
                        }
                    },
                    // Hata callback'i
                    onError: (error) => {
                        console.error('Gerçek zamanlı tespit hatası:', error);
                    }
                }
            );
            
            // Stream'i başlat
            if (realtimeStreamController) {
                realtimeStreamController.start();
            }
        } else {
            // WebSocket yoksa eski yöntemi kullan (interval ile)
            console.log('Interval ile gerçek zamanlı analiz başlatılıyor...');
            realtimeAnalysisInterval = setInterval(captureAndAnalyzeRealtimeFrame, 1500); // 1.5 saniyede bir kare analiz et
        }
    };
    
    /**
     * Gerçek zamanlı analizi durdurur
     */
    const stopRealtimeAnalysis = () => {
        // WebSocket stream controller varsa onu durdur
        if (realtimeStreamController) {
            realtimeStreamController.stop();
            realtimeStreamController = null;
        }
        
        // Interval varsa onu temizle
        if (realtimeAnalysisInterval) {
            clearInterval(realtimeAnalysisInterval);
            realtimeAnalysisInterval = null;
        }
    };
    
    /**
     * Gerçek zamanlı kare yakalar ve analiz eder
     */
    const captureAndAnalyzeRealtimeFrame = async () => {
        if (!realtimeStreaming || realtimeProcessing) return;
        
        // Tespit kilitlenmişse yeni analiz yapma
        if (detectionFrozen) return;
        
        realtimeProcessing = true;
        
        try {
            // Geçici canvas oluştur
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = realtimeVideo.videoWidth;
            tempCanvas.height = realtimeVideo.videoHeight;
            
            const context = tempCanvas.getContext('2d');
            context.drawImage(realtimeVideo, 0, 0, tempCanvas.width, tempCanvas.height);
            
            const frameData = tempCanvas.toDataURL('image/jpeg');
            
            // WebSocket bağlantısı var mı kontrol et
            if (websocketEnabled && WebSocketManager.isConnected()) {
                try {
                    // Kare verilerini WebSocket üzerinden gönder
                    const response = await WebSocketManager.sendImage(
                        frameData, 
                        'webcam', 
                        { 
                            confidence: AppConfig.confidenceThreshold,
                            enablePortionCalculation: AppConfig.portionCalculationEnabled 
                        }
                    );
                    
                    // Tespit sonuç canvas'ını güncelle
                    const detectionResultCanvas = document.getElementById('detectionResultCanvas');
                    if (detectionResultCanvas) {
                        if (response.success && response.data && response.data.length > 0) {
                            // Canvas boyutlarını ayarla (eğer video boyutları değiştiyse)
                            if (detectionResultCanvas.width !== realtimeVideo.videoWidth || 
                                detectionResultCanvas.height !== realtimeVideo.videoHeight) {
                                detectionResultCanvas.width = realtimeVideo.videoWidth;
                                detectionResultCanvas.height = realtimeVideo.videoHeight;
                            }
                            
                            // Video karesini canvas'a çiz
                            const ctx = detectionResultCanvas.getContext('2d');
                            ctx.clearRect(0, 0, detectionResultCanvas.width, detectionResultCanvas.height);
                            ctx.drawImage(realtimeVideo, 0, 0, detectionResultCanvas.width, detectionResultCanvas.height);
                            
                            // VisualizationModule ile tespitleri çiz
                            VisualizationModule.renderDetections(detectionResultCanvas, response.data);
                            
                            // Son tespit sonucunu kaydet (kilitleme için)
                            lastDetectionResult = response;
                            
                            // Callback'i çağır
                            if (imageAnalysisCallback) {
                                imageAnalysisCallback(response);
                            }
                        } else if (response.success) {
                            // Tespit yoksa sadece video karesini göster
                            const ctx = detectionResultCanvas.getContext('2d');
                            ctx.clearRect(0, 0, detectionResultCanvas.width, detectionResultCanvas.height);
                            ctx.drawImage(realtimeVideo, 0, 0, detectionResultCanvas.width, detectionResultCanvas.height);
                            
                            // "Tespit bulunamadı" mesajı göster
                            VisualizationModule.displayMessage(detectionResultCanvas, 'Tespit bulunamadı');
                        }
                    }
                    
                } catch (error) {
                    console.error('Gerçek zamanlı tespit hatası:', error);
                    // Hata durumunda sessizce devam et, bir sonraki kare için yeniden dene
                }
            }
            
        } catch (error) {
            console.error('Kare yakalama hatası:', error);
        } finally {
            realtimeProcessing = false;
        }
    };
    
    // Public API
    return {
        init,
        capturePhoto,
        handleFiles,
        analyzePhoto,
        saveImage,
        selectCamera,
        toggleDetectionFreeze
    };
})();

// CommonJS ve ES module uyumluluğu
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CameraModule;
} else if (typeof window !== 'undefined') {
    window.CameraModule = CameraModule;
}