/**
 * scripts.
 * User: raytin
 * Date: 13-8-9
 */
var gm = require('gm'),
    iconv = require('iconv-lite'),
    cheerio = require('cheerio');

var gui = require('nw.gui'),
    fs = require('fs'),
    modPath = require('path'),
    template = require('./js/template'),
    settings = require('./js/config');

var mass = {
    cache: {
        minusX: 20, // 标尺X的宽度
        minusY: 50, // 工具栏高度加标尺Y的高度
        statusHeight: 20,
        line: {},
        focusLineId: null,
        lineuuid: 1,
        lineX: 0,
        lineY: 0,
        rect: {},
        rectNum: 0,
        rectuuid: 1,
        focusRectId: null,
        mainResizeFlag: false,
        // 与package.json中保持一致
        minWidth: 700,
        minHeight: 500
    },
    sectionAdapter: {
        1: 'one',
        2: 'two',
        3: 'three',
        4: 'four',
        5: 'five',
        6: 'six',
        7: 'seven',
        8: 'eight',
        9: 'nine',
        10: 'ten',
        11: 'eleven',
        12: 'twelve',
        13: 'thirteen',
        14: 'fourteen',
        15: 'fifteen'
    },
    reg: {
        imgFile: /^(jpg|jpeg|png|gif)$/
    },
    // 载入文件
    loadFile: function(path, callback){
        var encodings = ['gbk', 'utf-8', 'gb2312', 'ascii', 'binary', 'base64'];
        if(fs.existsSync(path)){
            fs.readFile(path, function(err, data){
                if(err) return console.log(err);

                var str = iconv.decode(data, 'utf-8'),
                    encode = 'utf-8';

                // 编码不对试着用别的编码
                if(str.indexOf('�') != -1){
                    for(var i = 0, len = encodings.length; i < len; i++){
                        str = iconv.decode(data, encodings[i]);
                        if(str.indexOf('�') == -1){
                            encode = encodings[i];
                            console.log('文件编码： ' + encodings[i]);
                            break;
                        }
                    };
                }

                callback(str, encode);
            });
        }
    },
    resizeHandler: function(){
        var cache = mass.cache,
            win = $(window),
            back = $('#backing'),
            mainRight = $('.main_right'),
            previewImg = $('#previewImg'),
            preParent = previewImg.parent(),
            addImg = $('.addImg'),
            winWid = win.width(),
            winHei = win.height();

        // 背景层
        back.width(winWid).height(winHei);
        back.find('img').width(winWid).height(winHei);

        // 未添加图片时，按钮
        !addImg.hasClass('hide') && addImg.css({
            left: (mainRight.width() - 200) / 2,
            top: (mainRight.height() - 60) / 2
        });

        // 图片区外层宽度
        if(cache.mainResizeFlag){
            preParent.width(Math.min(cache.img.width + 11, winWid - 20));
            preParent.height(Math.min(cache.img.height + 11, winHei - 70));
        };
    },
    setImgCoverWidth: function(){
        var cache = this.cache,
            previewImg = $('#previewImg'),
            src = previewImg.attr('src'),
            preParent = previewImg.parent(),
            preWid = previewImg.width(),
            preHei = previewImg.height();

        gm(src).size(function(err, value){
            if(err){
                console.log(err);
                return mass.dialog('还未安装 GraphicsMagick 吗？请尝试以下方法：<br>1. 如果已安装，请在CMD命令中运行gm version，如未正确执行，请重启电脑（初次安装需要）<br>2. 未安装，请到 ftp://ftp.graphicsmagick.org/pub/GraphicsMagick/windows/ 下载相应版本',
                    [
                        {
                            value: '去往下载地址',
                            callback: function(){
                                gui.Shell.openExternal('ftp://ftp.graphicsmagick.org/pub/GraphicsMagick/windows/');
                            },
                            focus: true
                        },
                        {
                            value: '确定'
                        }
                    ]
                );
            }

            preWid = value.width;
            preHei = value.height;

            $('#J-imgCover').width(preWid).height(preHei);
            //preParent.width(Math.min(preWid + 11, screen.availWidth - 20));
            preParent.width(Math.min(preWid + 11, $(window).width() - 20));
            preParent.height(Math.min(preHei + 11, $(window).height() - 70));

            // 图片宽度小于配置中的最小宽度，则resize时不作操作
            if(preWid + 11 > cache.minWidth - 20 || preHei + 11 > cache.minHeight - 70){
                cache.mainResizeFlag = true;
            }
        });
    },
    // 遮罩
    overlay: function(type){
        var dom = $('#overlay');
        if(type === 'show'){
            dom.show();
        }else{
            dom.hide();
        }
    },
    // 处理拖拽文件至窗口
    dropFile: function(){
        var wrapper = document.getElementById('wrapper');

        wrapper.addEventListener("dragover", function(e){
            e.stopPropagation();
            e.preventDefault();
            mass.overlay('show');
        }, false);

        wrapper.addEventListener("drop", function(e){
            mass.dealDrop(e);
            return false;
        }, false);
    },
    // 处理拖拽进来的文件
    dealDrop: function(e){
        e.stopPropagation();
        e.preventDefault();

        var file = e.dataTransfer.files[0];

        if(!file) return;
        var fileFormat = file.name.substr(file.name.lastIndexOf('.') + 1);

        if( this.reg.imgFile.test(fileFormat) ){
            mass.cache.fileFormat = fileFormat;
            $('#J-Calculate').attr('src', file.path);
        }else{
            console.log(file.path + ' 文件不符合格式');
            this.dialog('请选择正确的文件格式 .jpg|.jpeg|.png|.gif', true);
        }

        mass.overlay('hide');
    },
    // 设置
    rockSettings: {
        // 显示界面之前初始化
        init: function(){
            var cache = mass.cache;

            var localSetting = localStorage.setting,
                setting = localSetting ? $.extend(true, settings.setting, JSON.parse(localSetting)) : settings.setting;

            console.log(setting);

            // 加载设置项 push到设置各表单值
            $('#dialogWrap').find('.column_checkbox, .column_radio, .column_select, .column_input, .column_textarea').each(function(){
                var that = $(this),
                    name = that.attr('data-name'),
                    value = this.value,
                    belong = that.attr('data-belong'),
                    type = that.attr('type') ? that.attr('type') : this.tagName.toLowerCase(),
                    valueInSet = belong ? setting[belong][name] : setting[name];

                if(!name) return;

                if(type === 'checkbox'){
                    this.checked = valueInSet;
                }
                else if(type === 'radio'){
                    if(valueInSet === value){
                        this.checked = true;
                    }
                    if(value === 'custom'){
                        that.next().find('.column_input').val( setting[belong].path );
                    }
                }
                else if(type === 'select'){
                    this.checked = valueInSet;
                }
                else if(type === 'text' || type === 'password'){
                    this.value = valueInSet;
                    console.log(that);
                }else if(name === 'template'){
                    if(cache.isBig){
                        if(cache.lineY > 1){
                            this.value = valueInSet.big2;
                            $('#width_big2').trigger('click');
                        }else{
                            this.value = valueInSet.big;
                            $('#width_big').trigger('click');
                        }
                    }else{
                        this.value = valueInSet.small;
                    }
                }
            });
        },
        // 监听设置中的用户交互
        listen: function(){
            var cache = mass.cache,
                dialogWrap = $('#dialogWrap'),
                tabCon = dialogWrap.find('.tab_content');

            var userSet = this.userSet;

            // tab切换
            dialogWrap.find('.tab_tigger_item').on('click', function(e){
                var that = $(this),
                    index = that.index();

                if(that.hasClass('on')) return;
                $('.tab_tigger_item').eq(index).addClass('on').siblings().removeClass('on');
                $('.tab_content_item').eq(index).removeClass('hide').siblings().addClass('hide');
            });

            // 自定义保存目录
            dialogWrap.find('.J-filePath_custom').click(function(){
                var setting_savePath = userSet.setting.savePath,
                    input = $(this),
                    hiddenFile = input.next();

                hiddenFile.trigger('click').on('change', function(){
                    if(this.value != ''){
                        input.val(this.value);
                        setting_savePath.mode = 'custom';
                        setting_savePath.path = this.value;
                    }
                });
            });

            // checkbox | radio | select | textarea
            tabCon.find('.column_checkbox, .column_radio, .column_select, .column_textarea').on('change', function(e){
                var that = $(this),
                    name = that.attr('data-name'),
                    noclick = that.attr('data-noclick'),
                    belong = that.attr('data-belong'),
                    value = this.value;

                if(!name || noclick) return;

                if(that.is(':checkbox')){
                    value = this.checked;
                }

                if(name === 'template'){
                    belong = 'template';
                    //name = cache.img && cache.img.width > 990 ? 'big' : 'small';
                    if(cache.isBig){
                        if(cache.lineY > 1){
                            name = 'big2';
                        }else{
                            name = 'big';
                        }
                    }else{
                        name = 'small';
                    }
                }

                console.log('change:crs')
                if(belong){
                    userSet.setting[belong][name] = value;
                    //space.saveItem(name, this.checked, belong);
                }else{
                    userSet.setting[name] = value;
                    //space.saveItem(name, this.checked);
                }
            });

            // 切换模板
            $('.column_radio_template').on('change', function(){
                var localSetting = localStorage.setting,
                    setting = localSetting ? $.extend(true, settings.setting, JSON.parse(localSetting)) : settings.setting;

                $('#J-templateArea').val(setting.template[this.value]);
            });
        },
        userSet : {
            setting: {
                template: {},
                savePath: {}
            }
        },
        // 验证
        validate: function(){
            return true;
        },
        // 保存所有设置
        saveAllSetting: function(){
            if(!this.validate()) return false;
            var setting = window.localStorage.setting ? JSON.parse(window.localStorage.setting) : {};

            $.extend(true, setting, this.userSet.setting);
            console.log(setting);
            window.localStorage.setting = JSON.stringify(setting);
            return true;
        },
        // 取得本地设置指定项
        getItemInSetting: function(key, belong){
            var localSet = window.localStorage.setting,
                setting, res = false;

            if(localSet){
                setting = JSON.parse(localSet);
                if(belong && setting[belong]){
                    res = setting[belong][key];
                }else{
                    res = setting[key];
                }
            }

            return res;
        },
        // 获取具体的打开时路径
        getDetailPath: function(){
            var mode = mass.rockSettings.getItemInSetting('mode', 'savePath');
            var res;

            if(mode === 'last'){
                res  = mass.rockSettings.itemInMemory('lastDirectory');
            }
            else if(mode === 'custom'){
                res = mass.rockSettings.getItemInSetting('path', 'savePath');
            }

            console.log('detail path: ' + res);
            return res;
        },
        // 获取/设置 memory中子项
        itemInMemory: function(key, value){
            var localMemory = window.localStorage.memory,
                memory, res = false;

            if(localMemory){
                memory = JSON.parse(localMemory);
                if(value !== undefined){
                    memory[key] = value;
                }else{
                    res = memory[key];
                }
            }else{
                if(value !== undefined){
                    memory = {};
                    memory[key] = value;
                }
            }

            if(value === undefined){
                return res;
            }else{
                window.localStorage.memory = JSON.stringify(memory);
            }
        }
    },
    // 导入导出用户设置
    exportUserSetting: function(){
        if(window.localStorage.setting){
            $('#J-hi-saveDiretoryForUserExport').trigger('click');
        }else{
            alertify.log('没有任何用户设置可导出。');
        }
    },
    importUserSetting: function(){
        $('#J-hi-saveDiretoryForUserImport').trigger('click');
    },
    // 标尺
    ruler: function(){
        var offsetWrap = $('#J-offset'),
            imgCover = $('#J-imgCover'),
            imgItem = imgCover.parent(),
            cache = this.cache,
            scrollTop = 0,
            scrollLeft = 0;

        var _move = false,
            _moved = false,
            currentMoveLineId = null,
            minusY = cache.minusY,
            minusX = cache.minusX,
            pos = 0,
            _type;

        $('.ruler-x, .ruler-y').mousedown(function(e){
            if(!$('.addImg').hasClass('hide')) return;
            var that = $(this),
                type = that.data('type');

            _type = type;
            _move = true;
            imgCover.addClass('lineMoving' + type);
        });

        $(document).mousemove(function(e){
            if(_move){
                scrollTop = imgItem.scrollTop();
                scrollLeft = imgItem.scrollLeft();
                if(_type === 'X'){
                    if(e.clientY > minusY){
                        // 边界控制
                        if(e.clientY + scrollTop > minusY + cache.img.height - 4) return;

                        if(!currentMoveLineId){
                            var line = $('<div class="lineX" id="line-'+ cache.lineuuid +'"></div>');
                            imgCover.append(line);
                            currentMoveLineId = 'line-' + cache.lineuuid;
                            cache.lineuuid++;
                            cache.lineX++;
                        }

                        pos = e.clientY + scrollTop - minusY;

                        $('#' + currentMoveLineId).css('top', pos);
                    }
                }
                else if(_type === 'Y'){
                    if(e.clientX > minusX){
                        // 边界控制
                        if(e.clientX + scrollLeft > minusX + cache.img.width - 4) return;

                        if(!currentMoveLineId){
                            var line = $('<div class="lineY" id="line-'+ cache.lineuuid +'"></div>');
                            imgCover.append(line);
                            currentMoveLineId = 'line-' + cache.lineuuid;
                            cache.lineuuid++;
                            cache.lineY++;
                        }

                        pos = e.clientX + scrollLeft - minusX;

                        $('#' + currentMoveLineId).css('left', pos);
                    }
                }
                _moved = true;
                offsetWrap.val(pos);
            }
        }).mouseup(function(e){
            if(_move){
                if(_moved){
                    // 删除切线
                    if((_type === 'X' && e.clientY < minusY) || (_type === 'Y' && e.clientX < minusX)){
                        mass.delLine(currentMoveLineId);
                    }
                    else{
                        // 把line 的偏移量存起来
                        cache.line[currentMoveLineId] = {
                            type: _type,
                            pos: pos
                        };

                        mass.focusLine(currentMoveLineId);

                        // 把切线的信息保存到本地
                        mass.storeLine();
                    }
                }
                imgCover.removeClass('lineMoving' + _type);

                _move = false;
                _moved = false;
                currentMoveLineId = null;
            }
        });

        // 切线选中操作
        imgCover.delegate('.lineX, .lineY', 'mousedown', function(e){
            e.stopPropagation();

            var that = $(this),
                lineId = that.attr('id');

            mass.focusLine(lineId);
            var cacheLine = cache.line[lineId];

            currentMoveLineId = lineId;
            _type = cacheLine.type;
            _move = true;

            offsetWrap.val(cacheLine.pos);

            imgCover.addClass('lineMoving' + _type);
        });
    },
    delLine: function(lineId){
        var cache = mass.cache,
            curLine = $('#' + lineId);
        if(curLine.hasClass('lineX')){
            cache.lineX--;
        }else{
            cache.lineY--;
        }

        delete mass.cache.line[lineId];
        cache.focusLineId = null;

        curLine.remove();

        this.storeLine();
        //$('#J-imgCover').removeClass('lineMovingX').removeClass('lineMovingY');
    },
    delRect: function(rectId){
        var cache = mass.cache,
            curRect = $('#' + rectId);

        cache.rectNum--;

        delete mass.cache.rect[rectId];
        cache.focusRectId = null;

        curRect.remove();
    },
    focusLine: function(lineId){
        var cache = mass.cache,
            imgCover = $('#J-imgCover');

        cache.focusRectId = null;
        cache.focusLineId = lineId;
        imgCover.find('.lineX, .lineY').removeClass('line-focus');
        imgCover.find('.rect').removeClass('rect-focus');
        $('#' + lineId).addClass('line-focus');
    },
    focusRect: function(rectId){
        var cache = mass.cache,
            imgCover = $('#J-imgCover');

        cache.focusRectId = rectId;
        cache.focusLineId = null;
        imgCover.find('.lineX, .lineY').removeClass('line-focus');
        imgCover.find('.rect').removeClass('rect-focus');
        $('#' + rectId).addClass('rect-focus');
    },
    /*
    * option:
    * {
    *     lineId: String, // not necessary
    *     type: String,
    *     pos: Number
    * }
    * */
    addLine: function(option){
        var cache = mass.cache,
            imgCover = $('#J-imgCover'),
            lineuuid = cache.lineuuid,
            lineId = option.lineId,
            type = option.type,
            pos = option.pos,
            styleIn;

        if(!lineId){
            lineId = 'line-' + lineuuid;
        }

        cache.line[lineId] = {
            type: type,
            pos: pos
        };
        cache.lineuuid++;

        if(type === 'X'){
            cache.lineX++;
            styleIn = 'top';
        }else{
            cache.lineY++;
            styleIn = 'left';
        }

        imgCover.append('<div class="line'+ type +'" id="'+ lineId +'" style="'+ styleIn +': '+ pos +'px"></div>');
    },
    /*
     * option:
     * {
     *     left: Number,
     *     top: Number,
     *     width: Number,
     *     height: Number,
     *     url: String,
     *     open: Boolean
     * }
     * */
    addRect: function(option){
        var cache = mass.cache,
            rectuuid = cache.rectuuid,
            rectId = 'rect-' + rectuuid,
            imgCover = $('#J-imgCover'),
            rectEntry = $('<div class="rect"></div>'),
            settingArea = $('<div class="setting-area hide"></div>'),
            resizeZone = $('<div class="setting"><span class="glyphicon glyphicon-cog"></span></div><div class="resize"></div>'),
            currentStyles;

        currentStyles = {
            left: option.left,
            top: option.top,
            width: option.width,
            height: option.height,
            cursor: 'move'
        };

        settingArea.append($('#J-template-rect-setting').html());
        rectEntry.attr('id', rectId).css(currentStyles).append(settingArea).append(resizeZone);
        imgCover.append(rectEntry);

        cache.rectuuid++;
        cache.rectNum++;
        cache.rect[rectId] = option;
    },
     // 对话框
    dialog: function(msg, buttons){
        var title = '提 示';

        var config = {
            title: title,
            content: msg,
            lock: true,
            resize: false,
            initialize: function(){
                mass.dialog_commonInit();
            }
        };

        if(typeof msg === 'object'){
            config.title = msg.title;
            config.content = msg.content;
            if(msg.width){
                config.width = msg.width;
            }
            if(msg.height){
                config.height = msg.height;
            }
        }

        if(buttons !== undefined){
            config.button = buttons === true ? [
                {
                    value: '确定',
                    callback: function(){},
                    focus: true
                }
            ] : buttons;
        }
        console.log('dialog: '+msg);
        return $.artDialog(config);
    },
    dialog_commonInit: function(){
        var dialogParent = $('.d-outer').parent();

        $('#wrapper').append(dialogParent).append($('.d-mask'));

        dialogParent.find('.d-button').addClass('custom-appearance');
    },
    confirmy: function(content, callback){
        $.artDialog({
            title: '请确认',
            content: content,
            lock: true,
            resize: false,
            button: [
                {
                    value: '确 定',
                    callback: function(){
                        callback();
                    }
                },
                {
                    value: '取 消',
                    focus: true
                }
            ],
            initialize: function(){
                mass.dialog_commonInit();
                var dialogParent = $('.d-outer').parent();

                dialogParent.hide();
                $('.dialogWrap').parent().css('padding', 0);

                dialogParent.fadeIn(300);
            }
        });
    },
    // 获取排好序的X Y坐标
    getSortPos: function(type){
        var res = [],
            lineHash = {};
        $.each(mass.cache.line, function(key, line){
            if(line.type === type){
                // 过滤重合的切线
                if(lineHash[type + '' + line.pos]){
                    mass.delLine(key);
                }else{
                    res.push(line.pos);
                    lineHash[type + '' + line.pos] = true;
                }
            }
        });
        return res.sort(function(a, b){return a - b > 0});
    },
    resetLine: function(){
        // 清除旧的参考线
        $('#J-imgCover').find('.lineX, .lineY').remove();

        $.extend(true, this.cache, {
            focusLineId: null,
            lineuuid: 1,
            lineX: 0,
            lineY: 0
        });

        this.cache.line = {};
    },
    resetRect: function(){
        // 清除旧的热区
        $('#J-imgCover').find('.rect').remove();

        $.extend(true, this.cache, {
            rectuuid: 1,
            rectNum: 0,
            focusRectId: null
        });

        this.cache.rect = {};
    },
    reset: function(mainResizeFlag){
        this.resetLine();
        this.resetRect();

        if(mainResizeFlag){
            this.cache.mainResizeFlag = false;
        }

        this.cache.clipboard = null;
        $('#J-copyCode').addClass('hide');
    },
    // 重新选择图片 初始化图片预览区
    previewInit: function(reset){
        var cache = this.cache,
            addImg = $('.addImg'),
            previewImg = $('#previewImg'),
            preParent = previewImg.parent(),
            imgCover = $('#J-imgCover'),
            statusInner = $('#J-statusBar-inner'),
            offset = $('#J-offset'),
            imgInfo = $('#J-imgInfo');

        this.reset(true);

        if(reset){
            addImg.removeClass('hide');
            statusInner.addClass('hide');

            previewImg.remove();
            imgCover.removeAttr('style');
            preParent.removeAttr('style');
        }else{
            !addImg.hasClass('hide') && addImg.addClass('hide');

            if(statusInner.hasClass('hide')){
                statusInner.removeClass('hide');
            };
            // 改变状态栏偏移量的值
            offset.val(0);
            imgInfo.text(cache.img.width + ' X '+ cache.img.height + ' --- ' + previewImg.attr('src'));
        }
    },
    // 保存切线列表
    storeLine: function(){
        var cache = mass.cache;
        if(cache.lineX || cache.lineY){
            window.localStorage.line = JSON.stringify(cache.line);
        }
    },
    // 批量导入切线
    importLines: function(lineObj, callback){
        var cache = mass.cache,
            availableLineNum = 0,
            flowLineNum = 0;

        _.each(lineObj, function(line){
            var type = line.type,
                pos = line.pos;

            if(type === 'X'){
                // 上次的记录中超出了图片区域
                if(pos > cache.img.height){
                    flowLineNum++;
                    return;
                };
            }else{
                if(pos > cache.img.width){
                    flowLineNum++;
                    return;
                };
            }

            availableLineNum++;

            mass.addLine({
                type: type,
                pos: pos
            });
        });

        if(callback){
            callback(availableLineNum, flowLineNum);
        }
    },
    // 批量导入热区
    importRects: function(rectObj, callback){
        _.each(rectObj, function(rect){
            mass.addRect(rect);
        });

        if(callback){
            callback();
        }
    },
    // 拉取最后一次的切线记录
    getLastLines: function(){
        var localLine = window.localStorage.line,
            cache = mass.cache,
            lineObj;

        if(!cache.img) return;

        if(!localLine){
            return alertify.log('没有切线记录。');
        }

        if(cache.lineX || cache.lineY){
            if(!window.confirm('检测到当前已有切线存在，此操作将会清空目前的切线，确定吗？')){
                return;
            }

            mass.resetLine();
        }

        lineObj = JSON.parse(localLine);

        mass.importLines(lineObj, function(availableLineNum, flowLineNum){
            // 上次所有切线都超出了当前图片区域
            if(availableLineNum == 0){
                return alertify.log('上次所有切线记录都超出了当前图片区域，此次操作无效。','error',10000);
            }
            else if(flowLineNum){
                alertify.log('记录应用成功。但记录中有 '+ flowLineNum +' 条切线超出当前图片范围，已失效。','',10000);
            }
            mass.storeLine();
        });
    },
    // 工具栏下拉菜单
    dropMenu: function(e){
        var target = $(e.target),
            type = target.data('type'),
            param = target.data('param');

        if(type){
            mass[type](param);
        }
    },
    golden_section: function(param){
        var cache = mass.cache,
            img = cache.img,
            imgCover = $('#J-imgCover'),
            ylines = mass.getSortPos('Y'),
            lineY = cache.lineY,
            //lineuuid = cache.lineuuid,
            pendLine = [],
            temp = [];

        if(!img) return;

        if(img.width < 990){
            return alertify.log('图片宽度少于990像素就算了吧~', 'error', 5000);
        }

        if(param === 'custom'){
            var val = window.prompt('请输入');
            console.log(val);
            if(val === null) return;

            if(val < 10){
                return alertify.log('至少给个10像素吧~', 'error', 5000);
            }
            param = parseInt(val);
        }

        pendLine.push({
            pos: (img.width - param) / 2,
            type: 'Y'
        });
        pendLine.push({
            pos: (img.width - param) / 2 + param,
            type: 'Y'
        });

        _.each(pendLine, function(line){
            var lineuuid = cache.lineuuid++;
            temp.push('<div class="lineY" id="line-'+ lineuuid +'" style="left: '+ line.pos +'px"></div>');
            cache.line['line-' + lineuuid] = {
                type: 'Y',
                pos: line.pos
            }
        });

        imgCover.append(temp.join(''));

        cache.lineY = lineY + 2;
        //cache.lineuuid = lineuuid + 3;
    },
    // 选择图片时触发
    imgChange: function(){
        this.previewInit();

        mass.setImgCoverWidth();

        mass.cache.isBig = mass.cache.img && mass.cache.img.width > 990;
        mass.cache.quickSavePath = null;

        this.checkConfigFile();
    },
    // 检查图片配置文件 - 有则导入
    checkConfigFile: function(){
        var cache = mass.cache,
            img = cache.img,
            imgDirectory = modPath.dirname(img.path),
            configPath = imgDirectory + '\\config.json';

        if(fs.existsSync(configPath)){
            alertify.log('检测到配置文件，已自动适配：' + configPath);
            fs.readFile(configPath, function(err, data){
                if(err){
                    return mass.dialog('配置文件读取错误！<br>' + err, true);
                }

                var decodeData = iconv.decode(data), parseData;

                try{
                    parseData = JSON.parse(decodeData);
                }catch(e){
                    mass.dialog('配置文件解析出错！请检查是否Json格式<br>' + e, true);
                    return console.log(e);
                }

                // 导入切线
                mass.importLines(parseData.line, function(availableLineNum, flowLineNum){
                    // 上次所有切线都超出了当前图片区域
                    if(availableLineNum == 0){
                        return alertify.log('是不是修改过origin图片或配置文件？所有切线都超出了当前图片区域，此次操作无切线导入。', 'error', 10000);
                    }
                    else if(flowLineNum){
                        alertify.log('是不是修改过origin图片或配置文件？配置中有 '+ flowLineNum +' 条切线超出当前图片范围，已失效。', '', 10000);
                    }
                    mass.storeLine();
                });

                // 导入热区
                mass.importRects(parseData.rect);

                cache.quickSavePath = imgDirectory;
            });
        }
    },
    getCutBlocks: function(children){
        var cache = mass.cache,
            lineX = cache.lineX,
            lineY = cache.lineY,
            plusTop = 0, plusLeft,
            blocks = [],
            allChildBlocks = [],
            posArrX, posArrY, curX, curY;

        var isBig2 = !!(cache.img.width > 990 && lineY > 1), temp,
            parentBlockIndex = 0,
            option;

        posArrX = mass.getSortPos('X');
        posArrY = mass.getSortPos('Y');
        posArrX.push(cache.img.height);
        posArrY.push(cache.img.width);

        if(lineX){
            for(var x = 0, xLen = posArrX.length; x < xLen; x++){
                curX = posArrX[x];

                plusLeft = 0;
                if(lineY){
                    if(isBig2){
                        plusLeft = posArrY[0];
                        temp = {
                            width: cache.img.width,
                            height: curX - plusTop,
                            x: 0,
                            y: x == 0 ? 0 : plusTop,
                            children: [],
                            cleanArea: {
                                x0: posArrY[0],
                                y0: x == 0 ? 0 : plusTop,
                                x1: posArrY[posArrY.length - 2],
                                y1: curX
                            }
                        };
                        blocks.push(temp);

                        for(var y = 1, yLen = posArrY.length - 1; y < yLen; y++){
                            curY = posArrY[y];

                            option = {
                                width: curY - plusLeft,
                                height: curX - plusTop,
                                x: plusLeft,
                                y: x == 0 ? 0 : plusTop,
                                left: y == 1 ? 0 : plusLeft - posArrY[0],
                                top: 0,
                                parentBlockIndex: parentBlockIndex,
                                index: y - 1
                            };
                            temp.children.push(option);
                            allChildBlocks.push(option);

                            plusLeft = curY;
                        }

                        parentBlockIndex++;
                    }
                    else{
                        for(var y = 0, yLen = posArrY.length; y < yLen; y++){
                            curY = posArrY[y];

                            blocks.push({
                                width: curY - plusLeft,
                                height: curX - plusTop,
                                x: plusLeft,
                                y: x == 0 ? 0 : plusTop
                            });

                            plusLeft = curY;
                        }
                    }
                }
                // 只有X轴的情况
                else{
                    blocks.push({
                        width: cache.img.width,
                        height: curX - plusTop,
                        x: 0,
                        y: x == 0 ? 0 : plusTop
                    });
                }

                plusTop = curX;
            }
        }
        // 只有Y轴的情况
        else{
            plusLeft = 0;
            for(var y = 0, yLen = posArrY.length; y < yLen; y++){
                curY = posArrY[y];

                blocks.push({
                    width: curY - plusLeft,
                    height: cache.img.height,
                    x: x == 0 ? 0 : plusLeft,
                    y: 0
                });

                plusLeft = curY;
            }
        }

        return children ? allChildBlocks : blocks;
    },
    // 切割
    cutImg: function(dir, callback){
        // 保存锁，避免疯狂保存的情况
        mass.cache.saveLock = true;

        var exportPath = dir,
            previewImg = $('#previewImg'),
            imgPath = previewImg.attr('src'),
            img = gm(imgPath);

        var imgCover = $('#J-imgCover'),
            cache = mass.cache,
            newFolder = mass.rockSettings.getItemInSetting('exportOption'),
            folder = callback ? '\\images' : '',
            imgName, exportPathByImgName, blocks, markBlocks;

        blocks = mass.getCutBlocks();

        markBlocks = blocks.slice();

        // 快捷导出
        if(cache.quickSavePath && callback){
            exportPath = cache.quickSavePath;
        }
        else{
            // 根据用户设置是否创建新文件夹存放
            if(newFolder && newFolder === 'newfolder'){
                imgName = modPath.basename(cache.img.path, '.' + cache.fileFormat);
                exportPathByImgName = exportPath + '\\' + imgName;
                if(!fs.existsSync(exportPathByImgName)){
                    console.log(333, exportPathByImgName);
                    fs.mkdirSync(exportPathByImgName);
                }
                exportPath = exportPathByImgName;
            }
        }

        var cutChild = function(children, index, callback){
            var target = children.slice(),
                num = 1;
            (function(){
                var arg = arguments;
                var item = target.shift();
                var exportFileName = exportPath + folder + '\\section-' + index + '-' + (num++) + '.' + cache.fileFormat;

                if(!item){
                    callback();
                    return;
                }

                img.crop(item.width, item.height, item.x, item.y).write(exportFileName, function(err){
                    if(err){
                        return console.log(err);
                    }
                    console.log('z-success:', exportFileName);
                    arg.callee();
                });
            })();
        };

        if(blocks.length){
            // 不存在images文件夹就新建一个
            if(callback && !fs.existsSync(exportPath + folder)){
                fs.mkdirSync(exportPath + folder);
            }

            var i = 1;
            (function(){
                var arg = arguments;
                var item = blocks.shift();
                var exportFileName = exportPath + folder + '\\section-' + (i++) + '.' + cache.fileFormat;
                //var exportFileNameBg = exportPath + folder + '\\bg-section-' + (i++) + '.' + cache.fileFormat;
                if(!item){
                    // 导出图片和HTML
                    if(callback){
                        callback(markBlocks, exportPath);
                    }
                    // 仅导出图片
                    else{
                        mass.dialog('切图完成！<br>文件位置：' + exportPath, [
                            {
                                value: '打开文件位置',
                                callback: function(){
                                    gui.Shell.showItemInFolder(exportPath + folder + '\\section-1.' + cache.fileFormat);
                                },
                                focus: true
                            },
                            {
                                value: '确定'
                            }
                        ]);

                        mass.cache.saveLock = false;
                    }

                    mass.rockSettings.itemInMemory('lastSaveDir', exportPath);
                    $('#J-hi-saveDiretory').val('');
                    return;
                };

                if(item.children){
                    img.fill("#fff").drawRectangle(item.cleanArea.x0 + 20, item.cleanArea.y0, item.cleanArea.x1 - 20, item.cleanArea.y1).crop(item.width, item.height, item.x, item.y).write(exportFileName, function(err){
                        if(err){
                            return console.log(err);
                        }
                        console.log('success:', exportFileName);
                        cutChild(item.children, i - 1, arg.callee);
                    });
                }
                else{
                    img.crop(item.width, item.height, item.x, item.y).write(exportFileName, function(err){
                        if(err){
                            return console.log(err);
                        }
                        console.log('success:', exportFileName);
                        arg.callee();
                    });
                }
            })();
        }
    },
    // 检查热区位置
    checkRect: function(){
        var cache = mass.cache,
            lines = cache.line,
            rects = cache.rect,
            isBig2 = !!(cache.img.width > 990 && cache.lineY > 1),
            critical = {
                X:{},
                Y:{}
            },
            rectInBlock = {},
            blocks,
            res = true;

        if(!cache.rectNum) return res;

        $('.rect').removeClass('rect-error');

        $.each(rects, function(rectId, rect){
            critical.Y.x = rect.left;
            critical.Y.y = rect.left + rect.width;
            critical.X.x = rect.top;
            critical.X.y = rect.top + rect.height;
            $.each(lines, function(lineId, line){
                var type = line.type,
                    pos = line.pos;

                if(pos > critical[type].x && pos < critical[type].y){
                    res = false;
                    console.log(rectId, type, critical);
                    console.log(lineId, pos);
                    console.log('--------');
                    $('#' + rectId).addClass('rect-error');
                }
            });
        });

        if(res){
            if(isBig2){
                blocks = mass.getCutBlocks('children');

                $.each(blocks, function(i, block){
                    var blockParentIndex = block.parentBlockIndex;
                    $.each(rects, function(rectId, rect){
                        var topAndSelfHeight = block.y + block.height,
                            leftAndSelfWidth = block.x + block.width;

                        if(block.width > rect.width && block.x < rect.left && block.y < rect.top && (topAndSelfHeight > rect.top + rect.height) && (leftAndSelfWidth > rect.left + rect.width)){
                            rectInBlock[blockParentIndex] = rectInBlock[blockParentIndex] || [];
                            rectInBlock[blockParentIndex].push({
                                rect: rect,
                                left: rect.left - block.x,
                                top: rect.top - block.y,
                                belongBlockIndex: block.index
                            });
                        }
                    });
                });
            }
            else{
                blocks = mass.getCutBlocks();

                $.each(blocks, function(i, block){
                    $.each(rects, function(rectId, rect){
                        var topAndSelfHeight = block.y + block.height,
                            leftAndSelfWidth = block.x + block.width;

                        if(block.width > rect.width && block.x < rect.left && block.y < rect.top && (topAndSelfHeight > rect.top + rect.height) && (leftAndSelfWidth > rect.left + rect.width)){
                            rectInBlock[i] = rectInBlock[i] || [];
                            rectInBlock[i].push({
                                rect: rect,
                                left: rect.left - block.x,
                                top: rect.top - block.y
                            });
                        }
                    });
                });
            }
        }
        cache.rectInBlock = rectInBlock;

        return res;
        //return false;
    },
    // 生成HTML
    buildHTML: function(blocks, path){
        var cache = mass.cache,
            img = cache.img,
            isBig = !!(img.width > 990 && cache.lineY === 0),
            isBig2 = !!(img.width > 990 && cache.lineY > 1);

        //console.log(blocks);
        mass.loadFile('./preview.html', function(data){
            var cheer = cheerio.load(data),
                blockLen = blocks.length,
                bodyCon = '',
                allBlockStyles = [],
                classHeaders = '',
                localTemplateSet, temp;

            $.each(blocks, function(i, item){
                var name = mass.sectionAdapter[i + 1] || (i + 1),
                    cla = 'ui-' + name;

                if(isBig){
                    // 保存每个块的具体样式
                    temp = {
                        name: name,
                        height: item.height,
                        num: i + 1,
                        format: cache.fileFormat
                    };
                }
                else if(isBig2){
                    temp = {
                        name: name,
                        height: item.height,
                        num: i + 1,
                        format: cache.fileFormat,
                        children: item.children
                    };
                }
                // 宽度小于990
                else{
                    temp = {
                        name: name,
                        width: item.width,
                        height: item.height,
                        num: i + 1,
                        format: cache.fileFormat,
                        left: item.x,
                        top: item.y
                    };

                    // 保存所有块的头样式
                    // eg: .ui-one, .ui-two, .ui-three, .ui-four{}
                    if(i === blockLen - 1){
                        classHeaders += '.' + cla;
                    }else{
                        classHeaders += '.' + cla + ', ';
                    }
                }

                if(cache.rectInBlock && cache.rectInBlock[i]){
                    if(isBig2){
                        _.each(cache.rectInBlock[i], function(curRect){
                            temp.children[curRect.belongBlockIndex].rect = temp.children[curRect.belongBlockIndex].rect || [];
                            temp.children[curRect.belongBlockIndex].rect.push(curRect);
                        });
                        //temp.children[cache.rectInBlock[i][0].belongBlockIndex].rect = cache.rectInBlock[i];
                    }else{
                        temp.rect = cache.rectInBlock[i];
                    }
                }

                allBlockStyles.push(temp);

            });

            /*_.each(allBlockStyles, function(block, blockIndex){
                //console.log(1);
                _.each(block.children, function(child, childIndex){
                    //return console.log(child.rect);
                    if(!child.rect){
                        console.log('norect')
                    }else{
                        //console.log(child.rect);
                        _.each(child.rect, function(rect){
                            //console.log(rect.rect.url);
                            console.log('hasrect============');
                            console.log(rect.rect);
                            console.log(rect.rect.url);
                            //console.log(rect.rect);
                            console.log('hasrect============ end');
                        });
                    }
                });
            });*/

            if(isBig){
                localTemplateSet = mass.rockSettings.getItemInSetting('big', 'template');
                !localTemplateSet && (localTemplateSet = template.styleBig);
                bodyCon = _.template(localTemplateSet)({
                    blockStyles: allBlockStyles,
                    blocks: allBlockStyles
                });
            }
            else if(isBig2){
                localTemplateSet = mass.rockSettings.getItemInSetting('big2', 'template');
                !localTemplateSet && (localTemplateSet = template.styleBig2);
                bodyCon = _.template(localTemplateSet)({
                    blockStyles: allBlockStyles,
                    blocks: allBlockStyles
                });
            }
            else{
                localTemplateSet = mass.rockSettings.getItemInSetting('small', 'template');
                !localTemplateSet && (localTemplateSet = template.style);
                bodyCon = _.template(localTemplateSet)({
                    blockStyles: allBlockStyles,
                    classHeaders: classHeaders,
                    blocks: allBlockStyles
                });
            }


            //cheer('#imageMasStyle').append(styleCon);
            cheer('body').append(bodyCon);
            cache.clipboard = bodyCon;

            fs.writeFile(path + '\\index.html', cheer.html(), function(err){
                if(err) return console.log(err);
                mass.dialog('导出图像和HTML成功！<br>文件位置：' + path, [
                    {
                        value: '浏览器中预览',
                        callback: function(){
                            gui.Shell.openExternal(path + '\\index.html');
                            return false;
                        },
                        focus: true
                    },
                    {
                        value: '打开文件位置',
                        callback: function(){
                            gui.Shell.showItemInFolder(path + '\\index.html');
                            return false;
                        }
                    },
                    {
                        value: '关闭'
                    }
                ]);
                alertify.success('导出成功！点击右上角按钮复制代码');

                $('#J-copyCode').removeClass('hide');

                // 已经有过导出操作，跳过此步
                if(!cache.quickSavePath){
                    // 生成origin图片
                    var readStream = fs.createReadStream(img.path),
                        writeStream = fs.createWriteStream(path + '\\origin.' + cache.fileFormat);

                    readStream.pipe(writeStream);
                    writeStream.on('close', function(){
                        console.log('original file created!');
                    });
                }

                // 生成config文件
                var configContent = '{\n' +
                        '\t"line": '+ JSON.stringify(cache.line) +',\n' +
                        //'\t"lineuuid": '+ cache.lineuuid +',\n' +
                        //'\t"lineX": '+ cache.lineX +',\n' +
                        //'\t"lineY": '+ cache.lineY +',\n' +
                        //'\t"rectNum": '+ cache.rectNum +',\n' +
                        //'\t"rectuuid": '+ cache.rectuuid +',\n' +
                        '\t"rect": '+ JSON.stringify(cache.rect) +'\n' +
                    '}';

                fs.createWriteStream(path + '\\config.json').write(configContent);

                // 解锁
                cache.saveLock = false;

                cache.quickSavePath = path;
            });
        });
    },
    // 导出HTML
    exportHTML: function(exportPath){
        mass.cutImg(exportPath, function(blocks, path){
            $('#J-hi-saveDiretoryForHtml').val('');
            mass.buildHTML(blocks, path);
        });
    },
    // 画热区
    drawMap: function(){
        var cache = mass.cache,
            imgCover = $('#J-imgCover'),
            imgItem = imgCover.parent(),
            newRect = $('<div class="rect"></div>'),
            _drawMove = false,
            _drawMoving = false,
            scrollTop = 0,
            scrollLeft = 0,
            imgWidth, imgHeight,
            left, top, distX, distY, rect, rectCreated;

        var _rectMove = false,
            _rectMoving = false,
            rectAddX = 0,
            rectAddY = 0,
            currentRectId, trueLeft, trueTop, currentRect;

        var _rectResize = false,
            _rectResizing = false,
            trueWidth, trueHeight, currentRectLeft, currentRectTop;

        imgCover.mousedown(function(e){
            // 右键不触发
            if(e.button === 2) return;
            if(cache.drawMap){
                _drawMove = true;
                left = e.clientX - cache.minusX + imgItem.scrollLeft();
                top = e.clientY - cache.minusY + imgItem.scrollTop();
                distX = left;
                distY = top;

                imgWidth = cache.img.width;
                imgHeight = cache.img.height;
            }
        });

        $(document).mousemove(function(e){
            if(_drawMove || _rectMove || _rectResize){
                scrollLeft = imgItem.scrollLeft();
                scrollTop = imgItem.scrollTop();
                distX = e.clientX - cache.minusX + scrollLeft;
                distY = e.clientY - cache.minusY + scrollTop;

                distX = Math.min(distX, imgWidth - 2);
                distY = Math.min(distY, imgHeight - 2);

                var $currentRect = $('#' + currentRectId);
            }

            if(_drawMove){
                if(!rectCreated){
                    rect = newRect.clone().attr('id', 'rect-' + cache.rectuuid);
                    imgCover.append(rect);
                    rectCreated = true;
                    mass.focusRect('rect-' + cache.rectuuid);

                    cache.rectuuid++;
                    cache.rectNum++;
                }

                rect.css({
                    left: left,
                    top: top,
                    width: distX - left,
                    height: distY - top
                });

                _drawMoving = true;
            }
            else if(_rectMove){
                trueLeft = distX - rectAddX;
                trueTop = distY - rectAddY;
                //cacheRect = cache.rect[currentRectId];

                // 子欲拖出图片区域之外，我偏不让
                // 拖到图像区域外松手时，将left值替换成边界值
                if(trueLeft > imgWidth - currentRect.width - 2){
                    trueLeft = imgWidth - currentRect.width - 2;
                }else if(trueLeft < 0){
                    trueLeft = 0;
                };
                if(trueTop > imgHeight - currentRect.height - 2){
                    trueTop = imgHeight - currentRect.height - 2;
                }else if(trueTop < 0){
                    trueTop = 0;
                };

                $currentRect.css({
                    left: trueLeft,
                    top: trueTop
                });

                _rectMoving = true;
            }
            else if(_rectResize){
                trueWidth = distX - currentRectLeft;
                trueHeight = distY - currentRectTop;

                // 子欲拖出图片区域之外，我偏不让
                if(trueWidth > imgWidth - currentRect.left - 2){
                    trueWidth = imgWidth - currentRect.left - 2;
                }else if(trueWidth < 10){
                    trueWidth = 10;
                };
                if(trueHeight > imgHeight - currentRect.top - 2){
                    trueHeight = imgHeight - currentRect.top - 2;
                }else if(trueHeight < 10){
                    trueHeight = 10;
                };

                $currentRect.css({
                    width: trueWidth,
                    height: trueHeight
                });

                // 热区设置层同步赋值
                if(!$currentRect.find('.setting-area').hasClass('hide')){
                    $currentRect.find('input[data-type="width"]').val(trueWidth);
                    $currentRect.find('input[data-type="height"]').val(trueHeight);
                }

                _rectResizing = true;
            }
        }).mouseup(function(){
            if(_drawMove){
                if(_drawMoving){
                    if(distX < left || distY < top){
                        mass.delRect(cache.focusRectId);
                    }
                    else{
                        // 超出图片区域之外，将dist值替换成边界值
                        if(distX > imgWidth - 2){
                            distX = imgWidth - 2;
                        }
                        if(distY > imgHeight - 2){
                            distY = imgHeight - 2;
                        }

                        cache.rect[cache.focusRectId] = {
                            left: left,
                            top: top,
                            width: Math.max(distX - left, 10),
                            height: Math.max(distY - top, 10),
                            url: '#',
                            open: false
                        };

                        rect.css('cursor', 'move')
                            .append($('#J-template-rect-setting').clone().removeAttr('id'))
                            .append('<div class="setting"><span class="glyphicon glyphicon-cog"></span></div><div class="resize"></div>');
                    }
                }

                _drawMove = false;
                _drawMoving = false;
                rectCreated = false;
            }

            if(_rectMove){
                if(_rectMoving){
                    cache.rect[currentRectId].left = trueLeft;
                    cache.rect[currentRectId].top = trueTop;

                    _rectMoving = false;
                }
                _rectMove = false;
            }

            if(_rectResize){
                if(_rectResizing){
                    cache.rect[currentRectId].width = trueWidth;
                    cache.rect[currentRectId].height = trueHeight;

                    _rectResizing = false;
                }
                _rectResize = false;

                if(cache.drawMap){
                    imgCover.removeClass('resizing');
                }
            }
        });

        // 热区移动
        imgCover.delegate('.rect', 'mousedown', function(e){
            e.stopPropagation();
            //if(e.button === 2) return;
            currentRectId = this.id;
            mass.focusRect(currentRectId);
            currentRect = cache.rect[cache.focusRectId];

            _rectMove = true;
            left = e.clientX - cache.minusX + imgItem.scrollLeft();
            top = e.clientY - cache.minusY + imgItem.scrollTop();
            distX = e.clientX - cache.minusX + scrollLeft;
            distY = e.clientY - cache.minusY + scrollTop;
            imgWidth = cache.img.width;
            imgHeight = cache.img.height;

            rectAddX = left - currentRect.left;
            rectAddY = top - currentRect.top;

            var $curRect = $('#' + currentRectId);
            if($curRect.hasClass('rect-error')){
                $curRect.removeClass('rect-error');
            }

            //$curRect.find('.setting-area').addClass('hide');
        });

        // 热区收缩
        imgCover.delegate('.resize', 'mousedown', function(e){
            e.stopPropagation();
            _rectResize = true;
            currentRectId = this.parentNode.id;
            mass.focusRect(currentRectId);
            currentRect = cache.rect[cache.focusRectId];

            currentRectLeft = currentRect.left;
            currentRectTop = currentRect.top;

            if(cache.drawMap){
                imgCover.addClass('resizing');
            }

            var $curRect = $('#' + currentRectId);
            if($curRect.hasClass('rect-error')){
                $curRect.removeClass('rect-error');
            }
        });

        // 热区设置
        imgCover.delegate('.setting', 'mousedown', function(e){
            e.stopPropagation();
            var that = $(this),
                area = that.prev(),
                rectId = that.parent().attr('id'),
                rect = cache.rect[rectId];

            if(area.hasClass('hide')){
                area.removeClass('hide');
                area.find('input').each(function(){
                    var curInput = $(this),
                        type = curInput.data('type');
                    if(curInput.is(':checkbox')){
                        if(rect[type]){
                            curInput.attr('checked', true);
                        }else{
                            curInput.removeAttr('checked');
                        }
                    }else{
                        rect[type] && curInput.val(rect[type]);
                    }
                });
            }else{
                area.addClass('hide');
            }
        }).delegate('.setting-area', 'mousedown', function(e){
            e.stopPropagation();
        }).delegate('.rect-setting-column input', 'change', function(e){
            var that = $(this),
                value = parseInt(that.val()),
                type = that.data('type'),
                rectId = that.parents('.rect').attr('id'),
                curRect = $('#' + rectId),
                rect = cache.rect[rectId];

            if(type === 'open'){
                value = that.is(':checked');
            }
            else if(type === 'width'){
                if(value > cache.img.width - rect.left - 2){
                    value = cache.img.width - rect.left - 2;
                }
                curRect.width(value)
            }
            else if(type === 'height'){
                if(value > cache.img.height - rect.top - 2){
                    value = cache.img.height - rect.top - 2;
                }
                curRect.height(value)
            }

            rect[type] = value;
            that.val(value);

            e.stopPropagation();
        });
    },
    beforeClose: function(){
        this.storeLine();
        return true;
    },
    keyboardMonitor: function(){
        var kibo = new Kibo(),
            cache = this.cache;

        kibo.down(['left', 'right', 'up', 'down'], function(e){
            if(offset.is(':focus') || $('#' + cache.focusRectId).find('input').is(':focus')) return;

            var key = e.which, direction;

            if(cache.focusLineId || cache.focusRectId){
                e.preventDefault();
            }
            else{
                return;
            }

            if(cache.focusLineId){
                var curLine = cache.line[cache.focusLineId],
                    curPos = curLine.pos,
                    permiY = curLine.type === 'Y' && (key === 37 || key === 39),
                    permiX = curLine.type === 'X' && (key === 38 || key === 40);

                direction = (key === 37 || key === 39) ? 'left' : 'top';

                if(!permiY && !permiX) return;

                // 留4px的边界
                if((key === 37 || key === 38) && curPos === 4) return;
                if((key === 39 && curPos === cache.img.width - 4) || (key === 40 && curPos === cache.img.height - 4)) return;

                var line = document.getElementById(cache.focusLineId);

                if(key === 37 || key === 38){
                    curLine.pos--;
                }else{
                    curLine.pos++;
                }
                offset.val(curLine.pos);
                line.style[direction] = curLine.pos + 'px';

                mass.storeLine();
            }else if(cache.focusRectId){
                var recter = document.getElementById(cache.focusRectId),
                    curRect = cache.rect[cache.focusRectId];

                direction = (key === 37 || key === 39) ? (e.shiftKey ? 'width' : 'left') : (e.shiftKey ? 'height' : 'top');

                // 留4px的边界
                var case1 = key === 37 && curRect.left < 1,
                    case2 = key === 39 && curRect.left > cache.img.width - curRect.width - 3,
                    case3 = key === 38 && curRect.top < 1,
                    case4 = key === 40 && curRect.top > cache.img.height - curRect.height - 3;

                if(case1 || case2 || case3 || case4) return;

                if(key === 37){
                    curRect[e.shiftKey ? 'width' : 'left']--;
                }else if(key === 39){
                    curRect[e.shiftKey ? 'width' : 'left']++;
                }else if(key === 38){
                    curRect[e.shiftKey ? 'height' : 'top']--;
                }else if(key === 40){
                    curRect[e.shiftKey ? 'height' : 'top']++;
                }

                if(e.shiftKey && !$('#' + cache.focusRectId).find('.setting-area').hasClass('hide')){
                    if(curRect[direction] < 10){
                        curRect[direction] = 10;
                    }
                    $('#' + cache.focusRectId).find('input[data-type="'+ direction +'"]').val(curRect[direction]);
                }

                offset.val(0);
                recter.style[direction] = curRect[direction] + 'px';
            };
        });
        kibo.down('delete', function(e){
            if(cache.img){
                if(cache.focusLineId){
                    mass.delLine(cache.focusLineId);
                }
                else if(cache.focusRectId){
                    mass.delRect(cache.focusRectId);
                }
            }
        });

        // 禁止ctrl A操作
        kibo.down('ctrl a', function(){
            return false;
        });

        // 快捷键
        kibo.down('ctrl s', function(e){
            if(e.shiftKey){
                $('#J-exportPet').trigger('click');
            }else{
                $('#J-exportHTML').trigger('click');
            }
        });
        kibo.down('ctrl q', function(){
            $('#J-useful-menu > .dropdown-toggle').trigger('click');
        });
        kibo.down('ctrl n', function(){
            $('#J-selectFile').trigger('click');
        });
        kibo.down('ctrl d', function(){
            $('#J-reset').trigger('click');
        });
        kibo.down('ctrl r', function(){
            $('#J-mapArea').trigger('click');
        });
    },
    observer: function(){
        var cache = this.cache,
            context = require('./js/contextmenu').init();

        var imgCover = $('#J-imgCover'),
            offset = $('#J-offset'),
            addImg = $('.addImg'),
            previewImg = $('#previewImg'),
            hideImgCalculate = $('#J-Calculate'),
            fileFormat;

        this.resizeHandler();

        // 文件拖拽
        this.dropFile();
        // 拖拽文件到界面没有drop 再次回到界面时移除遮罩
        $('#overlay').mouseover(function(e){
            $(this).hide();
        });

        // 标尺
        this.ruler();

        // 选择图片
        $('#J-selectFile, .addImg').click(function(e){
            // 默认打开上次打开的目录
            var lastDirectory = mass.rockSettings.itemInMemory('lastDirectory');
            if(lastDirectory){
                $('#J-hi-select').attr('nwworkingdir', lastDirectory).trigger('click');
            }else{
                $('#J-hi-select').removeAttr('nwworkingdir').trigger('click');
            }
        });

        //1. 先在隐藏img中检查图片宽高
        hideImgCalculate.load(function(){
            var that = $(this),
                imgPath = that.attr('src');

            if(imgPath === './img/hold.png'){
                return that.removeClass('init');
            }

            if(that.width() < 50 || that.height() < 50){
                alertify.log('啊嘞...我们是有原则滴，宽高少于50不切~');
            }else{
                var fileName = modPath.basename(imgPath);
                fileFormat = fileName.substr(fileName.lastIndexOf('.') + 1);
                cache.fileFormat = fileFormat;
                cache.img = {
                    width: that.width(),
                    height: that.height(),
                    path: imgPath
                };
                previewImg.attr('src', imgPath);
                mass.rockSettings.itemInMemory('lastDirectory', modPath.dirname(that.attr('src')));
            }
            $('#J-hi-select').val('');
        });

        //2. 宽高没问题，载入主区域
        previewImg.load(function(){
            var that = $(this);
            if(that.attr('src') === './img/hold.png'){
                return that.removeClass('init');
            }

            previewImg.hasClass('hide') && previewImg.removeClass('hide');
            mass.imgChange();

        });

        // 上传文件
        $('#J-hi-select').change(function(e){
            var val = this.value;

            if(val == '') return;

            // 检查path合法性
            var fileName = modPath.basename(val);
            fileFormat = fileName.substr(fileName.lastIndexOf('.') + 1);
            if(!mass.reg.imgFile.test(fileFormat)){
                mass.dialog('请选择 ".jpg|.jpeg" ".png" 或 ".gif" 格式的文件', true);
                return;
            }

            console.log(val);

            hideImgCalculate.attr('src', val);
        });

        // 导出切片
        $('#J-exportPet').click(function(){
            if(!cache.img) return alertify.log('没图，保存个球球啊？别闹了，先切图吧...');
            if(!cache.lineX && !cache.lineY) return alertify.log('啊嘞...是不是忘了划参考线了？');

            $('#J-hi-saveDiretory').trigger('click');
        });
        $('#J-hi-saveDiretory').change(function(){
            mass.cutImg(this.value);
        });

        // 导出HTML
        $('#J-exportHTML').click(function(){
            if(!cache.img) return alertify.log('没图，保存个球球啊？别闹了，先切图吧...');
            if(!cache.lineX && !cache.lineY) return alertify.log('啊嘞...是不是忘了划参考线了？');

            if(!mass.checkRect()){
                return alertify.log('热区位置错误，不能与切线重合，已标为红色背景，请先调整才能进行下一步操作。', 'error', 8000);
            };

            if(cache.saveLock){
                alertify.log('正在保存，请等待...');
            }
            else{
                if(cache.quickSavePath){
                    mass.exportHTML(cache.quickSavePath);
                }
                else{
                    $('#J-hi-saveDiretoryForHtml').trigger('click');
                }
            }
        });

        $('#J-hi-saveDiretoryForHtml').change(function(){
            mass.exportHTML(this.value);
        });

        $('#J-hi-saveDiretoryForUserImport').change(function(){
            var localSet = window.localStorage.setting,
                that = this,
                settingPath = that.value;
            fs.readFile(settingPath, function(err, data){
                if(err){
                    return mass.dialog('文件读取错误！<br>' + err, true);
                }

                var decodeData = iconv.decode(data), parseData;

                try{
                    parseData = JSON.parse(decodeData);
                }catch(e){
                    mass.dialog('文件解析出错！请检查是否Json格式<br>' + e, true);
                    return console.log(e);
                }

                if(localSet){
                    mass.confirmy('检测到之前已有配置，是否覆盖？', function(){
                        window.localStorage.setting = decodeData;
                        alertify.success('用户设置导入成功！');
                    });
                }
                else{
                    window.localStorage.setting = decodeData;
                    alertify.success('用户设置导入成功！');
                }

                $(that).val('');
            });
        });

        $('#J-hi-saveDiretoryForUserExport').change(function(){
            var localSet = window.localStorage.setting,
                that = this,
                path = that.value;

            if(localSet){
                fs.createWriteStream(path + '\\settings.json').write(localSet);
                mass.dialog('用户设置导出成功！<br>文件位置：' + path, [
                    {
                        value: '打开文件位置',
                        callback: function(){
                            gui.Shell.showItemInFolder(path + '\\settings.json');
                            return false;
                        },
                        focus: true
                    },
                    {
                        value: '关闭'
                    }
                ]);
                alertify.success('用户设置导出成功！');
                $(that).val('');
            }
        });

        // 画热区
        $('#J-mapArea').click(function(){
            if(imgCover.hasClass('mapCursor')){
                cache.drawMap = false;
                imgCover.removeClass('mapCursor');
                $(this).removeClass('current');
            }else{
                cache.drawMap = true;
                imgCover.addClass('mapCursor');
                $(this).addClass('current');
            }
        });
        this.drawMap();

        // setting
        $('#J-userSettings').click(function(){
            $.artDialog({
                title: '设 置',
                lock: true,
                resize: false,
                button: [
                    {
                        value: '保 存',
                        callback: function () {
                            console.log('点击保存')
                            return mass.rockSettings.saveAllSetting();
                        },
                        focus: true
                    },
                    {
                        value: '取 消',
                        callback: function () {
                            console.log('取消保存')
                        }
                    }
                ],
                initialize: function(){
                    mass.dialog_commonInit();
                    var dialogParent = $('.d-outer').parent();

                    this.content($('#J-settings').html());
                    dialogParent.hide();
                    $('.dialogWrap').parent().css('padding', 0);

                    // 打开设置界面前先初始化用户选择
                    mass.rockSettings.init();

                    dialogParent.fadeIn(300);

                    mass.rockSettings.listen();
                }
            });
        });

        // help
        $('#J-help').click(function(){
            mass.dialog({
                title: '关于',
                content: 'MarkTool 基于 <a href="https://github.com/rogerwang/node-webkit/">Node-Webkit</a> 开源项目<br><br>By 支付宝-综合前端组 <a href="http://jsfor.com">@柳裟</a>'
            }, true)
        });

        // 监听偏移量变化
        offset.change(function(){
            if(!cache.focusLineId) return;
            var cacheLine = cache.line[cache.focusLineId],
                that = $(this),
                val = that.val(),
                lt;

            cacheLine.type === 'X' && (val = Math.min(val, cache.img.height - 4));
            cacheLine.type === 'Y' && (val = Math.min(val, cache.img.width - 4));

            cacheLine.pos = val;

            lt = cacheLine.type === 'X' ? 'top' : 'left';
            $('#' + cache.focusLineId).css(lt, val + 'px');
            that.val(val);

            mass.storeLine();
        });

        this.keyboardMonitor();

        // 禁止外部选取操作
        $('html').on('selectstart', function(e){
            e.preventDefault();
        });

        // 右键
        imgCover.on('contextmenu', function(ev){
            ev.preventDefault();
            var target = $(ev.target);
            if(target.hasClass('imgCover')){
                context.previewMenu.popup(ev.clientX, ev.clientY);
            }
            else if(target.hasClass('rect')){
                context.rectMenu.popup(ev.clientX, ev.clientY);
            }
            else{
                context.lineMenu.popup(ev.clientX, ev.clientY);
            }
            return false;
        });

        // A
        $('body').delegate('a', 'click', function(e){
            var that = $(this);
            if(!that.attr('nopen')){
                cache.gui.Shell.openExternal(that.attr('href'));
            }
            e.preventDefault();
        });

        $('.toolbar').find('.toolbar-item:not(.toolbar-dropmenu)').attr('data-placement', 'bottom').end().tooltip({
            selector: '.toolbar-item'
        });

        $('.dropdown-menu li a').attr('nopen', 1).click(function(e){
            mass.dropMenu(e);
        });

        $('#J-reset').click(function(){
            if(cache.lineX || cache.lineY || cache.rectNum){
                mass.confirmy('将清空切线、热区等操作记录，确定吗？', function(){
                    mass.reset();
                });
            }
        });

        $('#J-luffy').click(function(){
            var path = 'D:\\UserData\\wb-shil\\Desktop\\imageMass\\test.jpg';
            /*var outpath = 'D:\\UserData\\wb-shil\\Desktop\\imageMass\\';
            gm(path).fill("#fff").drawRectangle(100,55, 290, 180).write(outpath + 'test12.jpg', function(err){
                if(err) return console.log(err);
                console.log('success!');
            });*/
            //console.log( mass.getCutBlocks() );
            var path2 = 'D:\\UserData\\wb-shil\\Desktop\\imageMass\\t10';
            var path3 = 'D:\\UserData\\wb-shil\\Desktop\\imageMass\\t12\\h1\\config.json';
            //mass.cutImg(path2);
            /*var readStream = fs.createReadStream(path),
                writeStream = fs.createWriteStream(path2);
            readStream.pipe(writeStream);
            writeStream.on('close', function(){
                console.log('success');
            });*/

            /*var cache = mass.cache;
            var str = '{\n' +
                    '\tline: '+ JSON.stringify(cache.line) +',\n' +
                    '\tlineuuid: '+ cache.lineuuid +',\n' +
                    '\tlineX: '+ cache.lineX +',\n' +
                    '\tlineY: '+ cache.lineY +',\n' +
                    '\trect: '+ JSON.stringify(cache.rect) +',\n' +
                    '\trectNum: '+ cache.rectNum +',\n' +
                    '\trectuuid: '+ cache.rectuuid +'\n' +
                '}';

            fs.createWriteStream(path2 + '\\config.json').write(str);*/
            /*fs.rename(path, path2, function(err){
                if(err) return console.log(err);
                console.log('success');
            });

            fs.readFile(path3, function(err, data){
                if(err) return console.log(err);
                console.log(data);
                console.log(iconv.decode(data));
                try{
                    console.log(JSON.parse(iconv.decode(data)));
                }catch(a){
                    console.log(a);
                }
            });*/

            alertify.log('aaaa', 5000);
        });

        $('#J-copyCode').click(function(){
            try{
                if(cache.clipboard){
                    gui.Clipboard.get().set(cache.clipboard);
                    alertify.log('复制成功。', 'success', 5000);
                }
            }catch(e){
                alertify.log('复制异常。', 'error', 5000);
            }
        });

        $(window).resize(this.resizeHandler);

        // 窗口关闭确认
        gui.Window.get().on('close', function(){
            if(mass.beforeClose()){
                this.close(true);
            };
        });
    },
    init: function(){
        global.mass = mass;
        global.$ = $;

        $(function(){
            gui.Window.get().show();
            mass.cache.gui = gui;

            mass.observer();
        });
    }
};
mass.init();