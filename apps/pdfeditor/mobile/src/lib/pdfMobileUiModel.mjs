/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const CONTEXT_COMMANDS = Object.freeze({
    page: Object.freeze([
        'pdf.clipboard.copy',
        'pdf.pages.cut',
        'pdf.pages.paste-before',
        'pdf.pages.paste-after',
        'pdf.redaction.current-page',
        'pdf.pages.add',
        'pdf.pages.rotate',
        'pdf.pages.remove',
    ]),
    annotation: Object.freeze([
        'pdf.clipboard.copy',
        'pdf.clipboard.cut',
        'pdf.clipboard.paste',
        'pdf.comment.add',
        'pdf.annotation.marker',
        'pdf.annotation.ink-start',
        'pdf.annotation.ink-stop',
        'pdf.annotation.remove-selected',
    ]),
    field: Object.freeze([
        'pdf.clipboard.copy',
        'pdf.clipboard.cut',
        'pdf.clipboard.paste',
        'pdf.forms.clear',
        'pdf.signatures.fields',
        'pdf.signatures.requested',
    ]),
    selection: Object.freeze([
        'pdf.clipboard.copy',
        'pdf.clipboard.cut',
        'pdf.clipboard.paste',
        'pdf.redaction.selection',
        'pdf.comment.add',
        'pdf.annotation.marker',
    ]),
});

const COMMAND_LABELS = Object.freeze({
    'pdf.file.save': ['Save', '保存'],
    'pdf.file.print': ['Print', '打印'],
    'pdf.file.download-pdf': ['Download PDF', '下载 PDF'],
    'pdf.file.properties': ['Document properties', '文档属性'],
    'pdf.clipboard.copy': ['Copy', '复制'],
    'pdf.clipboard.cut': ['Cut', '剪切'],
    'pdf.clipboard.paste': ['Paste', '粘贴'],
    'pdf.edit.undo': ['Undo', '撤销'],
    'pdf.edit.redo': ['Redo', '重做'],
    'pdf.edit.bold': ['Bold', '粗体'],
    'pdf.edit.italic': ['Italic', '斜体'],
    'pdf.edit.underline': ['Underline', '下划线'],
    'pdf.edit.strikeout': ['Strikeout', '删除线'],
    'pdf.edit.superscript': ['Superscript', '上标'],
    'pdf.edit.subscript': ['Subscript', '下标'],
    'pdf.edit.change-case': ['Change case', '更改大小写'],
    'pdf.edit.horizontal-align': ['Horizontal align', '水平对齐'],
    'pdf.edit.text-direction': ['Text direction', '文字方向'],
    'pdf.edit.select-all': ['Select all', '全选'],
    'pdf.edit.clear-formatting': ['Clear formatting', '清除格式'],
    'pdf.edit.font-size-increase': ['Increase font size', '增大字号'],
    'pdf.edit.font-size-decrease': ['Decrease font size', '减小字号'],
    'pdf.edit.indent-increase': ['Increase indent', '增加缩进'],
    'pdf.edit.indent-decrease': ['Decrease indent', '减少缩进'],
    'pdf.edit.select-tool': ['Select tool', '选择工具'],
    'pdf.edit.hand-tool': ['Hand tool', '抓手工具'],
    'pdf.edit.page-text': ['Edit page text', '编辑页面文字'],
    'pdf.edit.font-color': ['Font color', '字体颜色'],
    'pdf.edit.line-spacing': ['Line spacing', '行距'],
    'pdf.edit.columns': ['Columns', '分栏'],
    'pdf.edit.bullets': ['Bullets', '项目符号'],
    'pdf.edit.numbering': ['Numbering', '编号'],
    'pdf.edit.vertical-align': ['Vertical alignment', '垂直对齐'],
    'pdf.redaction.mark': ['Mark for redaction', '标记脱敏'],
    'pdf.redaction.selection': ['Selected text', '所选文字'],
    'pdf.redaction.current-page': ['Current page', '当前页'],
    'pdf.redaction.apply': ['Apply redaction', '应用脱敏'],
    'pdf.redaction.pages': ['Page range', '页码范围'],
    'pdf.redaction.search-all': ['Search results', '搜索结果'],
    'pdf.redaction.discard': ['Discard marks', '放弃标记'],
    'pdf.insert.image': ['Image', '图片'],
    'pdf.insert.image-url': ['Image link', '图片链接'],
    'pdf.insert.shape': ['Shape', '形状'],
    'pdf.insert.text-art': ['Text art', '艺术字'],
    'pdf.insert.table': ['Table', '表格'],
    'pdf.insert.hyperlink': ['Hyperlink', '超链接'],
    'pdf.insert.chart': ['Chart', '图表'],
    'pdf.insert.equation': ['Equation', '公式'],
    'pdf.insert.smartart': ['SmartArt', 'SmartArt'],
    'pdf.insert.symbol': ['Symbol', '符号'],
    'pdf.insert.date-time': ['Date and time', '日期和时间'],
    'pdf.insert.header-footer': ['Header and footer', '页眉和页脚'],
    'pdf.insert.page-number': ['Page number', '页码'],
    'pdf.comment.add': ['Comment', '评论'],
    'pdf.annotation.marker': ['Text markup', '文字标记'],
    'pdf.annotation.ink-start': ['Draw', '绘图'],
    'pdf.annotation.ink-stop': ['Stop drawing', '结束绘图'],
    'pdf.annotation.remove-selected': ['Remove selected', '删除所选'],
    'pdf.annotation.free-text': ['Free text', '自由文本'],
    'pdf.annotation.shape': ['Drawing shape', '绘图形状'],
    'pdf.annotation.stamp': ['Stamp', '图章'],
    'pdf.annotation.style': ['Annotation color', '批注颜色'],
    'pdf.pages.add': ['Add page', '添加页面'],
    'pdf.pages.remove': ['Remove page', '删除页面'],
    'pdf.pages.rotate': ['Rotate page', '旋转页面'],
    'pdf.pages.copy': ['Copy pages', '复制页面'],
    'pdf.pages.cut': ['Cut pages', '剪切页面'],
    'pdf.pages.paste-before': ['Paste before', '粘贴到前面'],
    'pdf.pages.paste-after': ['Paste after', '粘贴到后面'],
    'pdf.pages.first': ['First page', '第一页'],
    'pdf.pages.previous': ['Previous page', '上一页'],
    'pdf.pages.next': ['Next page', '下一页'],
    'pdf.pages.last': ['Last page', '最后一页'],
    'pdf.object.group': ['Group objects', '组合对象'],
    'pdf.object.ungroup': ['Ungroup objects', '取消组合'],
    'pdf.object.bring-front': ['Bring to front', '置于顶层'],
    'pdf.object.bring-back': ['Send to back', '置于底层'],
    'pdf.object.bring-forward': ['Bring forward', '上移一层'],
    'pdf.object.bring-backward': ['Send backward', '下移一层'],
    'pdf.object.align': ['Align objects', '对齐对象'],
    'pdf.object.merge': ['Merge shapes', '合并形状'],
    'pdf.table.merge-cells': ['Merge cells', '合并单元格'],
    'pdf.table.distribute-rows': ['Distribute rows', '平均分布行'],
    'pdf.table.distribute-columns': ['Distribute columns', '平均分布列'],
    'pdf.table.split-cells': ['Split cells', '拆分单元格'],
    'pdf.table.apply-properties': ['Table properties', '表格属性'],
    'pdf.forms.text': ['Text field', '文本字段'],
    'pdf.forms.date': ['Date field', '日期字段'],
    'pdf.forms.image': ['Image field', '图片字段'],
    'pdf.forms.checkbox': ['Checkbox', '复选框'],
    'pdf.forms.radio': ['Radio button', '单选按钮'],
    'pdf.forms.combo': ['Combo box', '组合框'],
    'pdf.forms.dropdown': ['Dropdown', '下拉列表'],
    'pdf.forms.email': ['Email field', '电子邮件字段'],
    'pdf.forms.phone': ['Phone field', '电话字段'],
    'pdf.forms.credit-card': ['Credit card field', '信用卡字段'],
    'pdf.forms.zip-code': ['ZIP code field', '邮政编码字段'],
    'pdf.forms.clear': ['Clear fields', '清除字段'],
    'pdf.forms.previous': ['Previous field', '上一个字段'],
    'pdf.forms.next': ['Next field', '下一个字段'],
    'pdf.forms.submit': ['Submit form', '提交表单'],
    'pdf.forms.signature': ['Signature field', '签名字段'],
    'pdf.forms.background-color': ['Field background', '字段背景色'],
    'pdf.forms.border-color': ['Field border', '字段边框色'],
    'pdf.forms.list-add': ['Add list item', '添加列表项'],
    'pdf.forms.list-delete': ['Delete list item', '删除列表项'],
    'pdf.forms.list-move': ['Move list item', '移动列表项'],
    'pdf.forms.lock': ['Lock field', '锁定字段'],
    'pdf.forms.clear-button-image': ['Clear button image', '清除按钮图片'],
    'pdf.signatures.apply-appearance': ['Add signature', '添加签名'],
    'pdf.signatures.certificates': ['Certificate signatures', '证书签名'],
    'pdf.signatures.fields': ['Signature fields', '签名字段'],
    'pdf.signatures.requested': ['Pending signatures', '待签名'],
    'pdf.image.apply-properties': ['Image properties', '图片属性'],
    'pdf.image.select-file': ['Replace image', '替换图片'],
    'pdf.image.crop-start': ['Crop', '裁剪'],
    'pdf.image.crop-end': ['Finish crop', '完成裁剪'],
    'pdf.image.crop-fill': ['Crop to fill', '裁剪以填充'],
    'pdf.image.crop-fit': ['Crop to fit', '裁剪以适应'],
    'pdf.image.fit-page': ['Original size', '原始尺寸'],
    'pdf.image.edit-object': ['Edit embedded object', '编辑嵌入对象'],
    'pdf.shape.apply-properties': ['Shape properties', '形状属性'],
    'pdf.shape.change-type': ['Change shape', '更改形状'],
    'pdf.shape.edit-points': ['Edit points', '编辑顶点'],
    'pdf.shape.select-image': ['Shape image fill', '形状图片填充'],
    'pdf.textart.apply-properties': ['Text art properties', '艺术字属性'],
    'pdf.textart.select-image': ['Text art image fill', '艺术字图片填充'],
    'pdf.chart.apply-properties': ['Chart properties', '图表属性'],
    'pdf.chart.edit-data': ['Edit chart data', '编辑图表数据'],
    'pdf.paragraph.tabs': ['Paragraph tabs', '段落制表位'],
    'pdf.view.dark-document': ['Dark document', '深色文档'],
    'pdf.view.thumbnail-size': ['Thumbnail size', '缩略图大小'],
    'pdf.collaboration.chat': ['Chat', '聊天'],
    'pdf.ui.quick-access': ['Quick access settings', '快速访问设置'],
    'pdf.ui.edit-rights': ['Editing rights', '编辑权限'],
    'pdf.ui.interface-theme': ['Interface theme', '界面主题'],
    'pdf.ui.navigation': ['Navigation', '导航'],
    'pdf.ui.thumbnails': ['Thumbnails', '缩略图'],
    'pdf.ui.search': ['Search document', '搜索文档'],
    'pdf.ui.comments': ['Comments panel', '评论面板'],
    'pdf.ui.about': ['About', '关于'],
    'pdf.ui.support': ['Support', '支持'],
    'pdf.ui.form-properties': ['Form properties', '表单属性'],
    'pdf.ui.image-properties': ['Image panel', '图片面板'],
    'pdf.ui.shape-properties': ['Shape panel', '形状面板'],
    'pdf.ui.table-properties': ['Table panel', '表格面板'],
    'pdf.ui.textart-properties': ['Text art panel', '艺术字面板'],
    'pdf.ui.chart-properties': ['Chart panel', '图表面板'],
    'pdf.ui.signature-properties': ['Signature properties', '签名属性'],
    'pdf.ui.chart-edit-links': ['Edit chart links', '编辑图表链接'],
    'pdf.ui.chart-update-data': ['Update chart data', '更新图表数据'],
    'pdf.ui.close-navigation': ['Close navigation', '关闭导航'],
    'pdf.ui.navigation-settings': ['Navigation settings', '导航设置'],
    'pdf.view.fit-page': ['Fit page', '适合页面'],
    'pdf.view.fit-width': ['Fit width', '适合宽度'],
    'pdf.view.zoom-in': ['Zoom in', '放大'],
    'pdf.view.zoom-out': ['Zoom out', '缩小'],
    'pdf.view.zoom': ['Zoom', '缩放'],
});

const COMMAND_INPUTS = Object.freeze({
    'pdf.file.download-pdf': Object.freeze({
        fields: Object.freeze([{name: 'saveAs', type: 'checkbox', label: ['Save as download', '另存为下载'], defaultValue: true, required: false}]),
    }),
    'pdf.edit.font-color': Object.freeze({
        fields: Object.freeze([{name: 'color', type: 'color', label: ['Font color', '字体颜色'], defaultValue: '#2067c4', required: true}]),
    }),
    'pdf.edit.line-spacing': Object.freeze({
        fields: Object.freeze([
            {name: 'type', type: 'number', label: ['Line rule', '行距规则'], defaultValue: 1, min: 0, step: 1, required: true},
            {name: 'value', type: 'number', label: ['Line spacing', '行距值'], defaultValue: 1.15, min: 0, step: 0.05, required: true},
        ]),
    }),
    'pdf.edit.bullets': Object.freeze({
        fields: Object.freeze([
            {name: 'type', type: 'number', label: ['List type', '列表类型'], defaultValue: 0, min: 0, step: 1, required: true},
            {name: 'subtype', type: 'number', label: ['List style', '列表样式'], defaultValue: 1, min: -1, step: 1, required: true},
        ]),
    }),
    'pdf.edit.numbering': Object.freeze({
        fields: Object.freeze([
            {name: 'type', type: 'number', label: ['List type', '列表类型'], defaultValue: 1, min: 0, step: 1, required: true},
            {name: 'subtype', type: 'number', label: ['List style', '列表样式'], defaultValue: 1, min: -1, step: 1, required: true},
        ]),
    }),
    'pdf.edit.vertical-align': Object.freeze({
        fields: Object.freeze([{name: 'value', type: 'number', label: ['Vertical alignment value', '垂直对齐值'], defaultValue: 0, min: 0, step: 1, required: true}]),
    }),
    'pdf.annotation.free-text': Object.freeze({
        fields: Object.freeze([{name: 'type', type: 'number', label: ['Text box type', '文本框类型'], defaultValue: 0, min: 0, step: 1, required: true}]),
    }),
    'pdf.annotation.stamp': Object.freeze({
        fields: Object.freeze([{name: 'type', type: 'number', label: ['Stamp type', '图章类型'], defaultValue: 0, min: 0, step: 1, required: true}]),
    }),
    'pdf.annotation.style': Object.freeze({
        fields: Object.freeze([{name: 'color', type: 'color', label: ['Annotation color', '批注颜色'], defaultValue: '#2067c4', required: true}]),
    }),
    'pdf.object.align': Object.freeze({
        fields: Object.freeze([
            {name: 'align', type: 'number', label: ['Alignment value', '对齐值'], defaultValue: 0, min: 0, step: 1, required: true},
            {name: 'selectedOnly', type: 'checkbox', label: ['Selected objects only', '仅所选对象'], defaultValue: true, required: false},
        ]),
    }),
    'pdf.object.merge': Object.freeze({
        fields: Object.freeze([{name: 'operation', type: 'number', label: ['Merge operation', '合并操作'], defaultValue: 0, min: 0, step: 1, required: true}]),
    }),
    'pdf.insert.hyperlink': Object.freeze({
        fields: Object.freeze([
            {name: 'url', type: 'url', label: ['URL', '网址'], defaultValue: '', required: true},
            {name: 'text', type: 'text', label: ['Display text', '显示文本'], defaultValue: '', required: false},
            {name: 'tooltip', type: 'text', label: ['Tooltip', '提示'], defaultValue: '', required: false},
        ]),
    }),
    'pdf.insert.chart': Object.freeze({
        fields: Object.freeze([{name: 'type', type: 'number', label: ['Chart type', '图表类型'], defaultValue: 0, min: 0, step: 1, required: true}]),
    }),
    'pdf.insert.equation': Object.freeze({
        fields: Object.freeze([{name: 'type', type: 'number', label: ['Equation type', '公式类型'], defaultValue: 0, min: 0, step: 1, required: true}]),
    }),
    'pdf.insert.smartart': Object.freeze({
        fields: Object.freeze([{name: 'type', type: 'number', label: ['SmartArt type', 'SmartArt 类型'], defaultValue: 0, min: 0, step: 1, required: true}]),
    }),
    'pdf.insert.symbol': Object.freeze({
        fields: Object.freeze([
            {name: 'font', type: 'text', label: ['Font', '字体'], defaultValue: 'Arial', required: true},
            {name: 'code', type: 'number', label: ['Character code', '字符编码'], defaultValue: 9679, min: 0, step: 1, required: true},
        ]),
    }),
    'pdf.table.split-cells': Object.freeze({
        fields: Object.freeze([
            {name: 'columns', type: 'number', label: ['Columns', '列数'], defaultValue: 2, min: 1, step: 1, required: true},
            {name: 'rows', type: 'number', label: ['Rows', '行数'], defaultValue: 2, min: 1, step: 1, required: true},
        ]),
    }),
    'pdf.forms.background-color': Object.freeze({
        fields: Object.freeze([{name: 'color', type: 'color', label: ['Field background', '字段背景色'], defaultValue: '#ffffff', required: true}]),
    }),
    'pdf.forms.border-color': Object.freeze({
        fields: Object.freeze([{name: 'color', type: 'color', label: ['Field border', '字段边框色'], defaultValue: '#2067c4', required: true}]),
    }),
    'pdf.forms.list-add': Object.freeze({
        fields: Object.freeze([
            {name: 'option', type: 'text', label: ['List item', '列表项'], defaultValue: '', required: true},
            {name: 'index', type: 'number', label: ['Insert index', '插入位置'], defaultValue: 0, min: 0, step: 1, required: true},
        ]),
    }),
    'pdf.forms.list-delete': Object.freeze({
        fields: Object.freeze([{name: 'index', type: 'number', label: ['List index', '列表位置'], defaultValue: 0, min: 0, step: 1, required: true}]),
    }),
    'pdf.forms.list-move': Object.freeze({
        fields: Object.freeze([
            {name: 'index', type: 'number', label: ['List index', '列表位置'], defaultValue: 0, min: 0, step: 1, required: true},
            {name: 'up', type: 'checkbox', label: ['Move up', '向上移动'], defaultValue: true, required: false},
        ]),
    }),
    'pdf.forms.lock': Object.freeze({
        fields: Object.freeze([{name: 'locked', type: 'checkbox', label: ['Lock field', '锁定字段'], defaultValue: true, required: false}]),
    }),
    'pdf.forms.clear-button-image': Object.freeze({
        fields: Object.freeze([{name: 'state', type: 'number', label: ['Button state', '按钮状态'], defaultValue: 0, min: 0, step: 1, required: true}]),
    }),
    'pdf.shape.change-type': Object.freeze({
        fields: Object.freeze([{name: 'type', type: 'text', label: ['Shape type', '形状类型'], defaultValue: 'rect', required: true}]),
    }),
    'pdf.shape.select-image': Object.freeze({
        fields: Object.freeze([{name: 'fillType', type: 'number', label: ['Fill type', '填充类型'], defaultValue: 1, min: 0, step: 1, required: true}]),
    }),
    'pdf.textart.select-image': Object.freeze({
        fields: Object.freeze([{name: 'fillType', type: 'number', label: ['Fill type', '填充类型'], defaultValue: 1, min: 0, step: 1, required: true}]),
    }),
    'pdf.view.dark-document': Object.freeze({
        fields: Object.freeze([{name: 'enabled', type: 'checkbox', label: ['Dark document', '深色文档'], defaultValue: true, required: false}]),
    }),
    'pdf.view.thumbnail-size': Object.freeze({
        fields: Object.freeze([{name: 'value', type: 'number', label: ['Thumbnail scale', '缩略图比例'], defaultValue: 1, min: 0.1, max: 10, step: 0.1, required: true}]),
    }),
    'pdf.file.properties': Object.freeze({
        fields: Object.freeze([
            {name: 'title', type: 'text', label: ['Title', '标题'], defaultValue: '', required: false},
            {name: 'subject', type: 'text', label: ['Subject', '主题'], defaultValue: '', required: false},
            {name: 'creator', type: 'text', label: ['Author', '作者'], defaultValue: '', required: false},
            {name: 'keywords', type: 'text', label: ['Keywords', '关键词'], defaultValue: '', required: false},
            {name: 'description', type: 'textarea', label: ['Description', '说明'], defaultValue: '', required: false},
        ]),
    }),
    'pdf.edit.columns': Object.freeze({
        fields: Object.freeze([
            {name: 'count', type: 'number', label: ['Column count', '分栏数'], defaultValue: 1, min: 1, max: 16, step: 1, required: true},
        ]),
    }),
    'pdf.annotation.shape': Object.freeze({
        fields: Object.freeze([
            {name: 'type', type: 'number', label: ['Annotation type', '批注类型'], defaultValue: 5, min: 0, step: 1, required: true},
            {name: 'color', type: 'color', label: ['Stroke color', '线条颜色'], defaultValue: '#2067c4', required: true},
            {name: 'width', type: 'number', label: ['Stroke width', '线条宽度'], defaultValue: 2, min: 0.25, max: 50, step: 0.25, required: true},
        ]),
    }),
    'pdf.insert.date-time': Object.freeze({
        fields: Object.freeze([
            {name: 'format', type: 'text', label: ['Date format', '日期格式'], defaultValue: 'yyyy-MM-dd', required: true},
            {name: 'language', type: 'number', label: ['Language ID', '语言 ID'], defaultValue: 1033, min: 0, step: 1, required: true},
            {name: 'update', type: 'checkbox', label: ['Update automatically', '自动更新'], defaultValue: true, required: false},
        ]),
    }),
    'pdf.table.apply-properties': Object.freeze({
        fields: Object.freeze([
            {name: 'rowHeight', type: 'number', label: ['Row height (mm)', '行高（毫米）'], defaultValue: 8, min: 0, step: 0.1, required: true},
            {name: 'columnWidth', type: 'number', label: ['Column width (mm)', '列宽（毫米）'], defaultValue: 24, min: 0, step: 0.1, required: true},
        ]),
    }),
    'pdf.image.apply-properties': Object.freeze({
        fields: Object.freeze([
            {name: 'rotation', type: 'number', label: ['Rotate (degrees)', '旋转（度）'], defaultValue: 0, min: -360, max: 360, step: 1, required: true},
            {name: 'flipHorizontal', type: 'checkbox', label: ['Flip horizontally', '水平翻转'], defaultValue: false, required: false},
            {name: 'flipVertical', type: 'checkbox', label: ['Flip vertically', '垂直翻转'], defaultValue: false, required: false},
        ]),
    }),
    'pdf.shape.apply-properties': Object.freeze({
        fields: Object.freeze([
            {name: 'rotation', type: 'number', label: ['Rotate (degrees)', '旋转（度）'], defaultValue: 0, min: -360, max: 360, step: 1, required: true},
            {name: 'flipHorizontal', type: 'checkbox', label: ['Flip horizontally', '水平翻转'], defaultValue: false, required: false},
            {name: 'flipVertical', type: 'checkbox', label: ['Flip vertically', '垂直翻转'], defaultValue: false, required: false},
        ]),
    }),
    'pdf.textart.apply-properties': Object.freeze({
        fields: Object.freeze([
            {name: 'color', type: 'color', label: ['Text art fill', '艺术字填充'], defaultValue: '#4f81bd', required: true},
            {name: 'rotation', type: 'number', label: ['Rotate (degrees)', '旋转（度）'], defaultValue: 0, min: -360, max: 360, step: 1, required: true},
            {name: 'flipHorizontal', type: 'checkbox', label: ['Flip horizontally', '水平翻转'], defaultValue: false, required: false},
            {name: 'flipVertical', type: 'checkbox', label: ['Flip vertically', '垂直翻转'], defaultValue: false, required: false},
        ]),
    }),
    'pdf.paragraph.tabs': Object.freeze({
        fields: Object.freeze([
            {name: 'position', type: 'number', label: ['Position (mm)', '位置（毫米）'], defaultValue: 10, min: 0, step: 0.1, required: true},
            {name: 'align', type: 'number', label: ['Alignment value', '对齐值'], defaultValue: 1, min: 0, step: 1, required: true},
            {name: 'leader', type: 'number', label: ['Leader value', '前导符值'], defaultValue: 0, min: 0, step: 1, required: true},
        ]),
    }),
    'pdf.chart.apply-properties': Object.freeze({
        fields: Object.freeze([
            {name: 'type', type: 'number', label: ['Chart type', '图表类型'], defaultValue: 0, min: 0, step: 1, required: false},
            {name: 'style', type: 'number', label: ['Chart style', '图表样式'], defaultValue: 1, min: 0, step: 1, required: false},
        ]),
    }),
    'pdf.redaction.pages': Object.freeze({
        inputMode: 'text',
        label: Object.freeze(['Page or range', '页码或范围']),
        multiline: false,
        placeholder: Object.freeze(['For example 1, 3-5', '例如 1, 3-5']),
        type: 'text',
    }),
    'pdf.redaction.search-all': Object.freeze({
        inputMode: 'search',
        label: Object.freeze(['Search results', '搜索结果']),
        multiline: false,
        placeholder: Object.freeze(['Enter text to find', '输入要查找的文字']),
        type: 'search',
    }),
    'pdf.insert.image-url': Object.freeze({
        inputMode: 'url',
        label: Object.freeze(['Image link', '图片链接']),
        multiline: false,
        placeholder: Object.freeze(['https://example.com/image.png', 'https://example.com/image.png']),
        type: 'url',
    }),
    'pdf.comment.add': Object.freeze({
        inputMode: 'text',
        label: Object.freeze(['Comment', '评论']),
        multiline: true,
        placeholder: Object.freeze(['Enter a comment', '输入评论']),
        type: 'text',
    }),
    'pdf.signatures.apply-appearance': Object.freeze({
        inputMode: 'text',
        label: Object.freeze(['Signature text', '签名文字']),
        multiline: false,
        placeholder: Object.freeze(['Enter signature text', '输入签名文字']),
        type: 'text',
    }),
});

const callFirst = (value, methods) => {
    for (const method of methods) {
        if (typeof value?.[method] !== 'function') continue;
        try {
            const result = value[method]();
            if (result !== undefined && result !== null && result !== '') return result;
        } catch {
            // Ignore malformed participant/selection facts and continue with fallbacks.
        }
    }
    return undefined;
};

export function resolvePdfSelectionContext(selection, Asc = {}) {
    const items = Array.isArray(selection) ? selection : [];
    const types = new Set(items.map(item => callFirst(item, ['get_ObjectType', 'GetObjectType'])));
    const constants = Asc.c_oAscTypeSelectElement || {};
    let kind = 'selection';

    if ((constants.Field !== undefined && types.has(constants.Field)) || types.has('field')) kind = 'field';
    else if ((constants.Annot !== undefined && types.has(constants.Annot)) ||
        types.has('annot') || types.has('annotation')) kind = 'annotation';
    else if ((constants.PdfPage !== undefined && types.has(constants.PdfPage)) ||
        types.has('pdf-page') || types.has('page')) kind = 'page';

    return {kind, commands: [...CONTEXT_COMMANDS[kind]]};
}

export function normalizePdfParticipants(users) {
    const values = Array.isArray(users)
        ? users
        : users && typeof users === 'object' ? Object.values(users) : [];

    return values.filter(Boolean).map((user, index) => {
        const id = callFirst(user, ['asc_getIdOriginal', 'asc_getId']) ?? user.id ?? `participant-${index + 1}`;
        const name = callFirst(user, ['asc_getUserName']) ?? user.name ?? 'Guest';
        const view = callFirst(user, ['asc_getView']) ?? user.view;
        return {
            id: String(id),
            name: String(name || 'Guest'),
            view: view === true,
        };
    });
}

export function filterPdfCommandSearchResults({commands, query, labelFor, resolve}) {
    const needle = String(query || '').trim().toLocaleLowerCase();
    if (!needle || !Array.isArray(commands)) return [];

    return commands.filter(command => {
        const resolution = typeof resolve === 'function' ? resolve(command.id) : {available: true};
        if (!resolution?.available) return false;
        const label = typeof labelFor === 'function' ? labelFor(command) : command.id;
        return `${label} ${command.id}`.toLocaleLowerCase().includes(needle);
    });
}

export function getPdfCommandLabel(commandId, chinese = false) {
    return COMMAND_LABELS[commandId]?.[chinese ? 1 : 0] || commandId;
}

export function resolvePdfCommandInput(commandId, chinese = false) {
    const descriptor = COMMAND_INPUTS[commandId];
    if (!descriptor) return null;
    const localeIndex = chinese ? 1 : 0;
    if (descriptor.fields) {
        return {
            commandId,
            fields: descriptor.fields.map(field => ({
                ...field,
                label: field.label[localeIndex],
                ...(field.options ? {
                    options: field.options.map(option => ({...option, label: option.label[localeIndex]})),
                } : {}),
            })),
        };
    }
    return {
        commandId,
        inputMode: descriptor.inputMode,
        label: descriptor.label[localeIndex],
        multiline: descriptor.multiline,
        placeholder: descriptor.placeholder[localeIndex],
        type: descriptor.type,
    };
}
