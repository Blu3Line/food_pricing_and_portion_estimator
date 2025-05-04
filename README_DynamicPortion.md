# Yemekhane Elektronik GUI - Porsiyon Hesaplama Sistemi (BACKEND İÇİN)

## Genel Bakış

Bu projenin backend kısmında bir YOLO tabanlı instance segmentation modeli kullanarak yemek tepsisindeki yiyecek, içecek ve çatal-kaşık gibi nesneleri tanımak ve fiyatlandırma yapmaktadır. Bu belge, çatal veya kaşık nesnelerini referans alarak yapılacak porsiyon ve fiyat hesaplama sistemine ilişkin plan içermektedir.

## Plan: Çatal/Kaşık Referanslı Porsiyon Hesaplama

### 1. Problem Tanımı
Mevcut sistemde yiyecekler tanınıyor ancak porsiyon miktarları sabit kabul ediliyor (genellikle 1 porsiyon). Gerçek dünyada, aynı yemeğin farklı miktarlarda servis edilmesi durumunda fiyatlandırmanın da orantılı olması gerekmektedir.

### 2. Çözüm Yaklaşımı
Çatal veya kaşığı bir ölçek referansı olarak kullanarak, diğer yiyeceklerin görünen segment alanlarından gerçek porsiyon miktarlarını hesaplayacağız (daha doğrusu yaklaşık tahmin edeceğiz çünkü görüntüden %100 mümkün olmuyor).

Çatal veya kaşığın gerçek dünyadaki boyutları biliniyor. Bu bilinen boyutları modelin o andaki görüntüden tespit ettiği çatal/kaşık piksel alanıyla ilişkilendirerek diğer yiyeceklerin piksel alanlarıyla yiyeceklerin gerçek dünya alanını tespit etmeye çalışacağız. Bu tespit edilen gerçek dünya alanıyla da porsiyon hesaplamasında kullanacağız. (Çatal/Kaşık gerçek dünya boyut bilgileri `yolo_server_dynamic_price.py` scriptinin içinde tutulsun ileriye dönük değiştirebilmek açısından)

Görüntüdeki yiyeceklerin porsiyon hesaplamaları standart artışlarla (0.5, 1.0, 1.5, 2.0 vb.) yapılacaktır. Yani hesaplanan porsiyon miktarı hangisine yakınsa ona yuvarlanacaktır. Böylelikle yemeğin yarım porsiyon 1 porsiyon ya da 1.5 porsiyon gibi olduğu vakit ücret ve yemek içerik bilgileri hesaplanırken de kullanılacaktır (kalori, besin değerleri, fiyat vs.)

### 3. Teknik Detaylar

#### 3.1 Veritabanı Güncellemeleri (foodsDB.json)
Porsiyon bazlı yiyeceklerin belirlenmesi gerekmektedir:
- Porsiyonu dikkate alınan ürünler: çorba, tavuk but, tavuk sote,tavuk kül bastı, pirinç pilavı, bulgur pilavı, salata, makarna, kuru fasulye, çiğ köfte, tavuk sote
- Birim bazında ürünler(Bunları porsiyon hesabına sokmaya gerek yok): su, ayran, ekmek, çatal, kaşık

Her yemek için veritabanına eklenecek yeni alanlar:
- `portionBased`: Boolean değer - yemeğin porsiyon bazlı hesaplanıp hesaplanmayacağını belirtir.

Porsiyon Hesabında kullanılacak yemeklerin veritabanına eklenecek yeni alanlar (ilgili yemek için gerçek değerlere benzer değerler üretmeye çalış):
- `food_height_cm`: Yiyeceğin ortalama kalınlığı (cm)
- `food_density_g_per_cm3`: Yiyeceğin ortalama yoğunluğu (g/cm³)
- `food_portion_reference_mass_g`: Tek (1) porsiyonun standart gramajı (gr cinsinden)

#### 3.2 YOLO Server Güncellemeleri (yolo_server_dynamic_price.py)

##### 3.2.1 Referans Nesne Tanımlamaları
`yolo_server_dynamic_price.py` içerisinde çatal ve kaşık için gerçek boyut bilgileri sabit değerler olarak tanımlanacak (değerleri standart bir çatal/kaşık için doldurursun):

```python
# Referans nesne boyutları (cm cinsinden)
REFERENCE_OBJECTS = {
    "catal": {
        "length": ??,  # Çatal uzunluğu (cm)
        "width": ??,    # Çatal genişliği (cm)
        "area": ??    # Yaklaşık alan (cm²)
    },
    "kasik": {
        "length": ??,  # Kaşık uzunluğu (cm)
        "width": ??,    # Kaşık genişliği (cm)
        "area": ??    # Yaklaşık alan (cm²)
    }
}
```

### 3.2.2 Referans Hesaplama
- Fotoğraftaki Çatal veya kaşık algılandığında, segment/maske alanını hesaplama (piksel alan)

- Gerçek boyutlarla segmentasyon alanı arasında bir ölçek faktörü oluşturma (Scale factor, 1 piksel²'nin kaç cm²'yekarşılık geldiğini veriyor.)
  - `scale_factor = reference_area_cm² / segment_area_pixels`

### 3.2.3 Porsiyon Hesaplama
- Yemek segmentasyonu yapıldığında, ilgili yemeğin segment alanını hesaplama

- Referans ölçeği kullanarak ilgili yemeğin o fotoğraftaki gerçek alanını bulma: 
  - `real_food_area_cm2  = detected_food_segment_area_pixels *  scale_factor`

- NOT: Belki segment_area_pixels, detected_food_segment_area_pixels gibi alanları bulmak için ayrı bir fonksiyon kullanılabilir?

- İlgili yiyeceğin ortalama kalınlığı (yüksekliği, cm) ile yüzey alanını (cm²) çarparız ve yiyeceğin hacmini (cm³) buluruz:
  - `food_volume = real_food_area_cm2 * food_height_cm`

- Hacim (cm³) ile yiyeceğin ortalama yoğunluğu (g/cm³, örneğin pilav için 0,96 g/cm³) çarparak yiyeceğin ağırlık/kütlesi (g) bulunur.
  - `food_mass_g  = food_volume_cm3 * food_density_g_per_cm3`

- Her yiyeceğin hesaplanan kütlesini, o yiyeceğe ait "bir (1) porsiyon" tanımındaki referans (örneğin pilav 150 g, et 100 g) gram miktarına böleriz. Böylelikle Yiyeceğin o fotoğraftaki porsiyonu hakkında yaklaşık değer elde etmiş oluruz.
  - `food_portion = food_mass_g / food_portion_reference_mass_g`

- Hesaplanan porsiyon değerini 0.5'lik artışlarla yuvarlama:
   0.5, 1.0, 1.5, 2.0... şeklinde (bunu sana bırakıyorum nasıl yapılacağını tam öngöremiyorum)

- Kod okunabilirliği/test edilebilirliği açısından ayrı ayrı fonksiyonlar ile bölünebilir belki? ör:
```python
def compute_scale_factor(ref_area_cm2, ref_area_px): ...
def pixel_area_to_cm2(pixel_area, scale_factor): ...
def compute_volume(area_cm2, height_cm): ...
def compute_mass(volume_cm3, density_g_per_cm3): ...
def compute_portion(mass_g, std_mass_g): ...
```

## WebSocket iletiminde düzenlemeler
- WebSocket yanıtlarında döndürülen JSON verisine yeni alanların eklenmesi ve düzeltimi:
```JSON
{
    "success": true,
    "data": [
        {
            "class": "bulgur pilav",
            "confidence": 0.9614816308021545,
            "bbox": [
                643,
                326,
                948,
                563
            ],
            "segments": [
                [
                    759.0,
                    327.0
                ],
                [
                    758.0,
                    328.0
                ],
                [
                    752.0,
                    328.0
                ],
                [
                    751.0,
                    329.0
                ],
                [
                    748.0,
                    329.0
                ]
                ... diğer segment noktaları
            ],
            "food_info": {
                "name": "Bulgur Pilavı",
                "portion_based":true, <--yeni
                "portion":1.5, <--yeni
                "base_price": 18.0,
                "portion_price":27.0, <-- yeni
                "calories": 255, <--- porsiyon miktarına göre oranlanarak değişiyor
                "nutrition": { <--- burdaki değerler de artık porsiyon miktarıyla oranlı
                    "protein": "6g",
                    "carbs": "48g",
                    "fat": "4,5g",
                    "fiber": "6g"
                },
                "ingredients": [
                    "Bulgur",
                    "Soğan",
                    "Domates salçası",
                    "Zeytinyağı",
                    "Baharatlar"
                ],
                "allergens": [
                    "Gluten"
                ]
            }
        },
        ...diğer tespit edilen yemek/içecekler
    ],
    "total_price":85.5, <--yeni
    "total_calories":550 <--yeni
}
```


## Olası Problemler?
- Hem çatal hem kaşık bulunduğunda durumu nasıl ele almalıyız? (belki iki referansı da kullanarak daha yakın bir tahmin yapammıza olanak sağlar? ölçeği ortalamasını alma vs.)

- İlgili resimde çatal veya kaşık yok ise durumu nasıl ele almalıyız?


