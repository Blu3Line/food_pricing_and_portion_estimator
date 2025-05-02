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
    let confidenceThreshold = 0.5; // YOLO güven eşiği
    let realtimeStreamController = null; // WebSocket stream controller

    /**
     * Modülü başlatır ve gerekli DOM elementlerini yapılandırır
     * @param {Function} onImageAnalysis - Resim analizi için callback fonksiyonu
     * @returns {boolean} - Başlatma başarılı mı?
     */
    const init = async (onImageAnalysis = null) => {
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

        // Başlangıçta varsayılan sekmeyi aktifleştir
        switchTab('photo');

        // WebSocket entegrasyonunu kontrol et
        websocketEnabled = typeof WebSocketManager !== 'undefined';
        
        // Confidence slider dinleyicisini ekle
        const confidenceSlider = document.getElementById('confidenceSlider');
        if (confidenceSlider) {
            confidenceSlider.addEventListener('input', (e) => {
                confidenceThreshold = parseFloat(e.target.value);
                // Değer göstergesini güncelle
                const confidenceValue = document.getElementById('confidenceValue');
                if (confidenceValue) {
                    confidenceValue.textContent = `${Math.round(confidenceThreshold * 100)}%`;
                }
            });
        }

        // Electron ortamını kontrol et ve kamera listesini getir
        if (window.environment && window.environment.isElectron) {
            try {
                await loadAvailableCameras();
            } catch (error) {
                console.error('Kamera listesi yüklenirken hata oluştu:', error);
            }
        }
        
        return true;
    };

    /**
     * Kullanılabilir kameraları yükler (Electron'a özgü)
     */
    const loadAvailableCameras = async () => {
        if (window.electronAPI && window.electronAPI.getVideoSources) {
            try {
                const cameras = await window.electronAPI.getVideoSources();
                console.log('Kullanılabilir kameralar:', cameras);
                
                // Kameralara göre UI güncellemesi yapılabilir
                // Örneğin: Kamera seçim dropdown'ı eklenebilir
            } catch (error) {
                console.error('Kamera listesi alınırken hata:', error);
            }
        }
    };

    /**
     * Belirli bir kamera aygıtını seçer
     * @param {string} deviceId - Kamera aygıt ID'si
     */
    const selectCamera = (deviceId) => {
        currentConstraints = { 
            video: deviceId ? { deviceId: { exact: deviceId } } : true,
            audio: false 
        };
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
        
        // Tab butonları için event listeners
        if (takePhotoTab) {
            takePhotoTab.addEventListener('click', () => switchTab('photo'));
        }
        
        if (uploadImageTab) {
            uploadImageTab.addEventListener('click', () => switchTab('upload'));
        }
        
        if (realTimeTab) {
            realTimeTab.addEventListener('click', () => switchTab('realtime'));
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
        
        // Sonuç bölümü butonları için event listeners
        if (backToCamera) {
            backToCamera.addEventListener('click', () => {
                showTab(currentTab);
                hideResultSection();
            });
        }
        
        if (analyzePhotoBtn) {
            analyzePhotoBtn.addEventListener('click', analyzePhoto);
        }
        
        // Confidence slider
        const confidenceSlider = document.getElementById('confidenceSlider');
        if (confidenceSlider) {
            confidenceSlider.value = confidenceThreshold;
            const confidenceValue = document.getElementById('confidenceValue');
            if (confidenceValue) {
                confidenceValue.textContent = `${Math.round(confidenceThreshold * 100)}%`;
            }
        }
    };

    /**
     * Tab değiştirme işlevi
     * @param {string} tabId - Tab ID ('photo', 'upload', 'realtime')
     */
    const switchTab = (tabId) => {
        // Önceki işlevleri temizle
        if (photoStreaming) stopPhotoMode();
        if (realtimeStreaming) stopRealtimeMode();
        
        // Tüm tabları ve içeriklerini gizle
        const tabs = document.querySelectorAll('.camera-tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        
        const tabContents = document.querySelectorAll('.camera-tab-content');
        tabContents.forEach(content => content.style.display = 'none');
        
        // Sonuç bölümünü gizle
        hideResultSection();
        
        // Doğru ID'yi belirle
        let tabElementId;
        switch(tabId) {
            case 'photo':
                tabElementId = 'takePhotoTab';
                break;
            case 'upload':
                tabElementId = 'uploadImageTab';
                break;
            case 'realtime':
                tabElementId = 'realTimeTab';
                break;
            default:
                tabElementId = 'takePhotoTab';
        }
        
        // Seçilen tabı ve içeriğini göster
        const selectedTab = document.getElementById(tabElementId);
        const selectedContent = document.getElementById(`${tabId}TabContent`);
        
        if (selectedTab) selectedTab.classList.add('active');
        if (selectedContent) selectedContent.style.display = 'block';
        
        // Geçerli tabı güncelle
        currentTab = tabId;
    };
    
    /**
     * Sonuç bölümünü gösterir
     */
    const showResultSection = () => {
        // Tüm tab içerikleri gizle
        const tabContents = document.querySelectorAll('.camera-tab-content');
        tabContents.forEach(content => content.style.display = 'none');
        
        // Sonuç bölümünü göster
        const resultSection = document.getElementById('resultSection');
        if (resultSection) resultSection.style.display = 'block';
    };
    
    /**
     * Sonuç bölümünü gizler
     */
    const hideResultSection = () => {
        const resultSection = document.getElementById('resultSection');
        if (resultSection) resultSection.style.display = 'none';
    };
    
    /**
     * Belirli bir tabı gösterir
     * @param {string} tabId - Tab ID ('photo', 'upload', 'realtime')
     */
    const showTab = (tabId) => {
        const tabContent = document.getElementById(`${tabId}TabContent`);
        if (tabContent) tabContent.style.display = 'block';
        
        // Doğru ID'yi belirle
        let tabElementId;
        switch(tabId) {
            case 'photo':
                tabElementId = 'takePhotoTab';
                break;
            case 'upload':
                tabElementId = 'uploadImageTab';
                break;
            case 'realtime':
                tabElementId = 'realTimeTab';
                break;
            default:
                tabElementId = 'takePhotoTab';
        }
        
        const tabButton = document.getElementById(tabElementId);
        if (tabButton) tabButton.classList.add('active');
    };
    
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
            showResultSection();
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
        showResultSection();
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
            showResultSection();
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
                // Resim verilerini WebSocket üzerinden gönder
                const response = await WebSocketManager.sendImage(
                    resultImage.src, 
                    'image', 
                    { confidence: confidenceThreshold }
                );
                
                if (response.success) {
                    // Görüntünün üzerine tespitleri çiz - VisualizationModule kullan
                    if (typeof VisualizationModule !== 'undefined') {
                        // Orijinal görüntü üzerine tespitleri çiz
                        await VisualizationModule.displayDetectionsOnImage(resultImage, response.data);
                    } else {
                        // Eski görselleştirme yöntemi için
                        visualizeResults(resultImage, response.data);
                    }
                    
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
                
                // Hata durumunda Electron API'ye geri dön (eğer varsa)
                if (window.electronAPI && window.electronAPI.detectFood) {
                    fallbackToElectronAPI();
                }
            }
        } else if (window.electronAPI && window.electronAPI.detectFood) {
            // WebSocket bağlantısı yoksa Electron API kullan
            fallbackToElectronAPI();
        } else {
            // Ne WebSocket ne de Electron API yoksa hata göster
            console.error('Yemek tespiti için hiçbir mekanizma bulunamadı');
            if (detectedItemsEl) {
                detectedItemsEl.innerHTML = '<li class="error-item">Tespit sistemi kullanılamıyor. Lütfen bağlantı durumunu kontrol edin.</li>';
            }
        }
    };
    
    /**
     * Yedek olarak Electron API'yi kullanır
     */
    const fallbackToElectronAPI = async () => {
        try {
            const detectedItemsEl = document.getElementById('detectedItems');
            if (detectedItemsEl) {
                detectedItemsEl.innerHTML += '<li>WebSocket bağlantısı kurulamadı, Electron API üzerinden tespit ediliyor...</li>';
            }
            
            const detectedFoods = await window.electronAPI.detectFood(resultImage.src);
            
            // Tespit sonuçlarını işle
            if (imageAnalysisCallback) {
                imageAnalysisCallback(detectedFoods);
            }
        } catch (error) {
            console.error('Yemek tespiti hatası:', error);
            const detectedItemsEl = document.getElementById('detectedItems');
            if (detectedItemsEl) {
                detectedItemsEl.innerHTML = '<li class="error-item">Tespit sırasında bir hata oluştu. Lütfen tekrar deneyin.</li>';
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
                    confidence: confidenceThreshold,
                    // Sonuç callback'i
                    onResult: (response) => {
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
                                
                                // VisualizationModule ile çizim yapma
                                if (typeof VisualizationModule !== 'undefined') {
                                    // Tespitleri çiz (sonuç canvas'ı üzerine)
                                    VisualizationModule.renderDetections(detectionResultCanvas, response.data);
                                } else {
                                    // Eski yöntem
                                    drawDetections(detectionResultCanvas, response.data);
                                }
                                
                                // Callback'i çağır
                                if (imageAnalysisCallback) {
                                    imageAnalysisCallback(response);
                                }
                            } else if (response.success) {
                                // Tespit yoksa sadece video karesini göster
                                const ctx = detectionResultCanvas.getContext('2d');
                                ctx.clearRect(0, 0, detectionResultCanvas.width, detectionResultCanvas.height);
                                ctx.drawImage(realtimeVideo, 0, 0, detectionResultCanvas.width, detectionResultCanvas.height);
                                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                                ctx.fillRect(0, 0, detectionResultCanvas.width, detectionResultCanvas.height);
                                
                                // "Tespit bulunamadı" mesajı
                                ctx.font = '16px Arial';
                                ctx.fillStyle = 'white';
                                ctx.textAlign = 'center';
                                ctx.fillText('Tespit bulunamadı', detectionResultCanvas.width / 2, detectionResultCanvas.height / 2);
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
                        { confidence: confidenceThreshold }
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
                            
                            // VisualizationModule ile çizim yapma
                            if (typeof VisualizationModule !== 'undefined') {
                                // Tespitleri çiz (sonuç canvas'ı üzerine)
                                VisualizationModule.renderDetections(detectionResultCanvas, response.data);
                            } else {
                                // Eski yöntem
                                drawDetections(detectionResultCanvas, response.data);
                            }
                            
                            // Callback'i çağır
                            if (imageAnalysisCallback) {
                                imageAnalysisCallback(response);
                            }
                        } else if (response.success) {
                            // Tespit yoksa sadece video karesini göster
                            const ctx = detectionResultCanvas.getContext('2d');
                            ctx.clearRect(0, 0, detectionResultCanvas.width, detectionResultCanvas.height);
                            ctx.drawImage(realtimeVideo, 0, 0, detectionResultCanvas.width, detectionResultCanvas.height);
                            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                            ctx.fillRect(0, 0, detectionResultCanvas.width, detectionResultCanvas.height);
                            
                            // "Tespit bulunamadı" mesajı
                            ctx.font = '16px Arial';
                            ctx.fillStyle = 'white';
                            ctx.textAlign = 'center';
                            ctx.fillText('Tespit bulunamadı', detectionResultCanvas.width / 2, detectionResultCanvas.height / 2);
                        }
                    }
                    
                } catch (error) {
                    console.error('Gerçek zamanlı tespit hatası:', error);
                    // Hata durumunda sessizce devam et, bir sonraki kare için yeniden dene
                }
            } else if (window.electronAPI && window.electronAPI.detectFood) {
                // WebSocket bağlantısı yoksa Electron API kullan
                try {
                    const detectedFoods = await window.electronAPI.detectFood(frameData);
                    
                    // Tespit sonuçlarını işle
                    if (imageAnalysisCallback) {
                        imageAnalysisCallback(detectedFoods);
                    }
                } catch (error) {
                    console.error('Gerçek zamanlı Electron tespit hatası:', error);
                }
            }
            
        } catch (error) {
            console.error('Kare yakalama hatası:', error);
        } finally {
            realtimeProcessing = false;
        }
    };
    
    /**
     * Tespitleri overlay üzerine çizer
     * @param {HTMLCanvasElement} canvas - Çizim yapılacak canvas
     * @param {Array} detections - Tespit sonuçları
     */
    const drawDetections = (canvas, detections) => {
        if (!canvas || !detections || !detections.length) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Her bir tespit için
        for (const detection of detections) {
            const { class: className, confidence, bbox, segments } = detection;
            
            // Sınıf için renk belirle
            const color = getColorForClass(className);
            
            // Bounding box çiz
            if (bbox && bbox.length === 4) {
                const [x1, y1, x2, y2] = bbox;
                
                ctx.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                ctx.lineWidth = 2;
                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                
                // Sınıf etiketi çiz
                ctx.font = '14px Arial';
                ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                const label = `${className}: ${Math.round(confidence * 100)}%`;
                ctx.fillText(label, x1, y1 > 20 ? y1 - 5 : y1 + 20);
            }
            
            // Segmentasyon poligonu çiz
            if (segments && segments.length > 2) {
                ctx.beginPath();
                ctx.moveTo(segments[0][0], segments[0][1]);
                
                for (let i = 1; i < segments.length; i++) {
                    ctx.lineTo(segments[i][0], segments[i][1]);
                }
                
                ctx.closePath();
                ctx.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // Yarı saydam dolgu
                ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.3)`;
                ctx.fill();
            }
        }
    };
    
    /**
     * Deteksiyon overlay'i temizler
     * @param {HTMLCanvasElement} canvas - Temizlenecek canvas
     */
    const clearDetectionOverlay = (canvas) => {
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    
    /**
     * Tespit sonuçlarını görselleştirir
     * @param {HTMLImageElement} img - Sonuçların çizileceği resim elementi
     * @param {Array} detections - Tespit sonuçları
     */
    const visualizeResults = (img, detections) => {
        if (!img || !detections || !detections.length) return;
        
        // Canvas oluştur ve resmi kopyala
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Tespitleri çiz
        drawDetections(canvas, detections);
        
        // Resmi güncelle
        img.src = canvas.toDataURL('image/png');
    };
    
    /**
     * Sınıf adına göre renk oluşturur
     * @param {string} className - Sınıf adı
     * @returns {Array} - RGB renk değerleri
     */
    const getColorForClass = (className) => {
        // Basit hash fonksiyonu
        let hash = 0;
        for (let i = 0; i < className.length; i++) {
            hash = className.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // RGB değerleri oluştur (0-255 arası)
        const r = (hash & 0xFF);
        const g = ((hash >> 8) & 0xFF);
        const b = ((hash >> 16) & 0xFF);
        
        return [r, g, b];
    };

    // Public API
    return {
        init,
        switchTab,
        capturePhoto,
        handleFiles,
        analyzePhoto,
        saveImage,
        selectCamera,
        visualizeResults
    };
})();

// CommonJS ve ES module uyumluluğu
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CameraModule;
} else if (typeof window !== 'undefined') {
    window.CameraModule = CameraModule;
}