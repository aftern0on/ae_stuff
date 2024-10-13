function Background() {
    this.scaleAndPrecompose = function(layer, comp) {
        try {
            // Получаем исходные размеры изображения
            var footage = layer.source;
            var originalWidth = footage.width;
            var originalHeight = footage.height;

            // Определяем масштаб по высоте композиции
            var compHeight = comp.height;
            var scaleY = (compHeight / originalHeight) * 100;
            var scaleX = scaleY;

            // Применяем масштаб к исходному слою
            layer.scale.setValue([scaleX + scaleX / 100 * 2, scaleY + scaleY / 100 * 2]);

            // Получаем новые размеры слоя после масштабирования
            var layerDuration;
            if (footage.hasVideo && footage.duration > 0)
                layerDuration = footage.duration;
            else
                layerDuration = comp.duration;
            var newLayerWidth = originalWidth * (compHeight / originalHeight);
            var newLayerHeight = compHeight;

            // Создание новой композиции с теми же размерами, что и слой
            var newCompWidth = Math.round(newLayerWidth);
            var newCompHeight = Math.round(newLayerHeight);
            var newComp = app.project.items.addComp(
                footage.name + '_scaled',
                newCompWidth,
                newCompHeight,
                1,
                layerDuration,
                comp.frameRate
            );

            // Перенос слоя в новую композицию
            layer.copyToComp(newComp);
            var newLayer = newComp.layer(1);

            // Устанавливаем позицию слоя в центре и начало слоя на 0
            newLayer.position.setValue([newCompWidth / 2, newCompHeight / 2]);
            newLayer.startTime = 0;
            newLayer.inPoint = 0;
            newLayer.outPoint = footage.duration;
            newLayer.motionBlur = true;

            // Добавление новой композиции в основной проект
            var precompLayer = comp.layers.add(newComp);
            precompLayer.inPoint = layer.inPoint - layer.startTime;
            precompLayer.outPoint = layer.outPoint - layer.startTime;
            precompLayer.moveBefore(layer);
            precompLayer.startTime = layer.startTime;
            layer.remove();

            return precompLayer; // Возвращаем новый слой
        } catch (e) {
            alert("Ошибка в функции scaleAndPrecompose для слоя " + layer.name + ": " + e.message);
        }
    }

    this.addBackgroundEffects = function(layer) {
        // Добавление эффектов подложки: гаусс
        var blurEffect = layer.property("Effects").addProperty("ADBE Gaussian Blur 2");
        blurEffect.property("ADBE Gaussian Blur 2-0001").setValue(15);  // Сила блюра
        blurEffect.property("ADBE Gaussian Blur 2-0002").setValue(true);  // Повторение пикселей по краям

        // Черно-белый эффект
        var tintEffect = layer.property("Effects").addProperty("ADBE Tint");
        tintEffect.property("ADBE Tint-0001").setValue([0, 0, 0]); // Устанавливаем цвет для черного
        tintEffect.property("ADBE Tint-0002").setValue([255, 255, 255]); // Устанавливаем цвет для белого
        tintEffect.property("ADBE Tint-0003").setValue(85); // Устанавливаем интенсивность эффекта в процентах (от 0 до 100)
    }

    this.addLeadEffects = function(layer) {
        // Добавление эффектов главной картинки: тень
        var shadowEffect = layer.property("Effects").addProperty("ADBE Drop Shadow");
        shadowEffect.property("ADBE Drop Shadow-0002").setValue(255); // Непрозрачность тени
        shadowEffect.property("ADBE Drop Shadow-0004").setValue(0); // Дистанция
        shadowEffect.property("ADBE Drop Shadow-0005").setValue(100); // Мягкость тени
    }
    
    this.createBackgroundFromClips = function(selectedLayer, comp) {
        // Рассчитываем соотношение сторон композиции
        var compAspectRatio = comp.width / comp.height;
            
        // Проверяем, является ли слой видеослоем
        if (selectedLayer instanceof AVLayer && selectedLayer.source instanceof FootageItem) {
            // Удаление мягких краев
            var footage = selectedLayer.source;
            if ((comp.width / footage.width > 2) && (comp.height / footage.height > 2)) {
                // Применяем масштабирование и предкомпозирование
                var precompLayer = this.scaleAndPrecompose(selectedLayer, comp);
                // Обновляем ссылку на слой после предкомпозирования
                selectedLayer = precompLayer;
            }

            // Рассчитываем соотношение сторон клипа
            var footageAspectRatio = selectedLayer.source.width / selectedLayer.source.height;
            var deviation = Math.abs(footageAspectRatio - compAspectRatio);
            var scale_deviation_limit = 0.3;

            // Проверяем, совпадает ли соотношение сторон клипа и композиции
            if (deviation > scale_deviation_limit) {  // Если лимит превышен, то делается подложка
                // Дублируем слой для подложки
                var backgroundLayer = selectedLayer.duplicate();
                backgroundLayer.moveAfter(selectedLayer); // Перемещаем подложку под исходный слой

                // Сброс масштаба и преобразование до размера композиции с сохранением пропорций
                backgroundLayer.scale.setValue([100, 100]);
                var scaleX = (comp.width / selectedLayer.source.width) * 100;
                var scaleY = scaleX;
                backgroundLayer.scale.setValue([scaleX, scaleY]);
                this.addLeadEffects(selectedLayer);
                this.addBackgroundEffects(backgroundLayer);
            } else if (deviation !== 0) {  // Если лимит не превышен, значит картинка просто масштабируется
                selectedLayer.scale.setValue([100, 100]);
                var scaleX = (comp.width / selectedLayer.source.width) * 100;
                var scaleY = (comp.height / selectedLayer.source.height) * 100;
                selectedLayer.scale.setValue([scaleX, scaleY]);
            }
        }
    }

    this.run = function() {
        // Проверяем, открыт ли проект
        if (app.project == null) {
            alert("Проект не открыт.");
            return;
        }

        // Проверяем, есть ли открытая композиция
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem)) {
            alert("Пожалуйста, выберите композицию.");
            return;
        }

        // Создаем копию списка слоев для безопасной обработки
        var originalLayers = [];
        for (var i = 0; i < comp.selectedLayers.length; i++) {
            originalLayers.push(comp.selectedLayers[i]);
        }

        // Начало обработки
        for (var i = 0; i < originalLayers.length; i++) {
            try {
                var selectedLayer = originalLayers[i];
                this.createBackgroundFromClips(selectedLayer, comp);  // Запуск функции
            } catch (e) {
                alert("Ошибка: " + e.toString() + '\nСтрока: ' + e.line);
            }
        }
    }
}

function Transition() {
    this.moveBezier = function(layer, comp, direction) {
        // Учет масштаба слоя
        var scale = layer.property("Scale").valueAtTime(comp.time, false);
        var scaleFactorX = scale[0] / 100; // Коэффициент по X
        var scaleFactorY = scale[1] / 100; // Коэффициент по Y

        // Установка ключевых кадров
        var initPos = layer.property("Position").valueAtTime(comp.time, false);
        var newPos;

        // Вычисление конечной позиции в зависимости от направления
        switch (direction) {
            case "right":
                newPos = [comp.width + (layer.width * scaleFactorX) / 2, initPos[1]];
                break;
            case "left":
                newPos = [-(layer.width * scaleFactorX) / 2, initPos[1]];
                break;
            case "up":
                newPos = [initPos[0], -(layer.height * scaleFactorY) / 2];
                break;
            case "down":
                newPos = [initPos[0], comp.height + (layer.height * scaleFactorY) / 2];
                break;
            default:
                throw new Error("Неверное направление движения");
        }
        layer.property("Position").setValueAtTime(comp.time, initPos);
        layer.property("Position").setValueAtTime(layer.outPoint, newPos);
        var startKeyIndex = layer.property("Position").nearestKeyIndex(comp.time);
        var endKeyIndex = layer.property("Position").nearestKeyIndex(layer.outPoint);
        
        // Установка интерполяции перехода
        layer.property("Position").setInterpolationTypeAtKey(startKeyIndex, KeyframeInterpolationType.BEZIER);
        layer.property("Position").setInterpolationTypeAtKey(endKeyIndex, KeyframeInterpolationType.BEZIER);
        var easeIn = new KeyframeEase(0, 75);
        var easeOut = new KeyframeEase(0, 75);
        layer.property("Position").setTemporalEaseAtKey(startKeyIndex, [easeIn], [easeOut]);
        layer.property("Position").setTemporalEaseAtKey(endKeyIndex, [easeIn], [easeOut]);
    }

    this.run = function(direction) {
        // Проверяем, открыт ли проект
        if (app.project == null) {
            alert("Проект не открыт.");
            return;
        }

        // Проверяем, есть ли открытая композиция
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem)) {
            alert("Пожалуйста, выберите композицию.");
            return;
        }

        // Проверяем, выбран ли слой
        var layer = comp.selectedLayers[0];
        if (layer == null) {
            alert("Пожалуйста, выберите слой.");
            return;
        }
        this.moveBezier(layer, comp, direction);
    }
}

function UI() {
    // Создаем интерфейс внутри панели
    this.create = function(thisObj) {
        // Если панель, используем её; если нет - создаем новое окно
        var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Скриптонит.jsx", undefined, {resizeable: true});

        // Убеждаемся, что панель создана
        if (myPanel != null) {
            var buttons = [
                ["Создать фон", function() { new Background().run() }],
                ["Переход >", function() { new Transition().run("right") }],
                ["Переход <", function() { new Transition().run("left") }],
                ["Переход ↑", function() { new Transition().run("up") }],
                ["Переход ↓", function() { new Transition().run("down") }]
            ]

            for (var i = 0; i < buttons.length; i++) {
                this.addButton(myPanel, buttons[i][0], buttons[i][1]);
            }

            // Если это панель, подстраиваемся под её размер
            if (myPanel instanceof Window) {
                myPanel.center();
                myPanel.show();
            }

            return myPanel;
        } else {
            alert("Не удалось создать панель.");
        }
    }

    this.addButton = function(myPanel, name, func) {
        // Добавляем кнопку для запуска скрипта
        // func - функция, которая будет выполняться при нажатии кнопки
        var runButton = myPanel.add("button", undefined, name);

        // Обработка нажатия кнопки
        runButton.onClick = function() {
            app.beginUndoGroup(name);
            try {
                func();
            } catch (e) {
                alert("Ошибка: " + e.toString() + '\nСтрока: ' + e.line);
            }

            app.endUndoGroup();
        };
    }

    this.show = function(menu_panel) {
        // Проверка и создание UI панели при загрузке
        var ScriptMenuPanel = menu_panel;
        if (ScriptMenuPanel instanceof Panel) {
            this.create(ScriptMenuPanel);
        } else {
            this.create(menu_panel);
        }

        // Принудительно обновляем интерфейс панели
        if (ScriptMenuPanel.layout) {
            ScriptMenuPanel.layout.layout(true);
        }
    }
}

var ui = new UI();
ui.show(this);