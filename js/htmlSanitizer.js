const tagWhitelist = [
    'A','ABBR',
    'B', 'BLOCKQUOTE', 'BODY', 'BR',
    'CENTER', 'CODE',
    'DIV',
    'EM',
    'FIELDSET', 'FONT',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR',
    'I', 'IMG',
    'LABEL', 'LEGEND', 'LI',
    'OL',
    'P', 'PRE',
    'SMALL', 'SOURCE', 'SPAN', 'STRONG', 'STYLE',
    'TABLE', 'TBODY', 'TR', 'TD', 'TH', 'THEAD',
    'UL', 'U'
];

const attributeWhitelist = [
    'align',
    'color', 'class',
    'height', 'href',
    'src', 'style',
    'target', 'title', 'type',
    'width'
];

const cssWhitelist = [
    'background-color', 'border',
    'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-collapse', 'box-shadow',
    'color',
    'display',
    'font-size', 'font-weight', 'font-family', 'filter',
    'list-style', 'list-style-position', 'list-style-image', 'list-style-type',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'max-width',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'text-align',
    'text-decoration', 'text-decoration-line', 'text-decoration-style', 'text-decoration-color',
    'width', 'height'
];

const schemaWhiteList = ['http:', 'https:'];

export const sanitizeHtml = (input) => {
    let iframe = document.createElement('iframe');
    if(iframe['sandbox'] === undefined) {
        alert('ブラウザが古いためiframeのsandboxモードが使えません。新しいブラウザを使用してください。');
        return '';
    }
    iframe['sandbox'] = 'allow-same-origin';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    let iframedoc = iframe.contentDocument || iframe.contentWindow.document;
    if(iframedoc.body == null) iframedoc.write("<body></body>"); // null in IE
    iframedoc.body.innerHTML = input;

    const makeSanitizedCopy = (node) => {
        if(node.nodeType === Node.TEXT_NODE) {
            var newNode = node.cloneNode(true);
        } else if(node.nodeType == Node.ELEMENT_NODE && (tagWhitelist.indexOf(node.tagName) > -1)) {
            newNode = iframedoc.createElement(node.tagName);

            if(node.tagName === "STYLE") {
                console.groupCollapsed("スタイル関連:");
                let cssString = "";
                for (const cssRule of node.sheet.cssRules) {
                    cssString += cssRule.selectorText + " {";
                    for (const styleName of cssRule.style) {
                        if(cssWhitelist.indexOf(styleName) > -1) {
                            cssString += styleName + ":" + cssRule.style.getPropertyValue(styleName) + ";";
                            // bugがある？ので以下の方法は使えない。sheetがundefinedになる。
                            // newNode.sheet.insertRule(cssRule.selectorText + "{" + styleName + ":" + cssRule.style.getPropertyValue(styleName) + ";}") 
                            console.log("〇:" + styleName);
                        } else {
                            console.log("ｘ:" + styleName);
                        }
                    }
                    cssString += "}\n";
                }
                console.groupEnd();
                //console.log(cssString);
                newNode.innerHTML = cssString;
            } else {
                for (const attr of node.attributes) {
                    attributeLoop:
                    if(attributeWhitelist.indexOf(attr.name) > -1) {
                        if(attr.name === "style") {
                            for (const styleName of node.style) {
                                if(cssWhitelist.indexOf(styleName) > -1) {
                                    newNode.style.setProperty(styleName, node.style.getPropertyValue(styleName));
                                    console.log("〇：" + styleName);
                                } else {
                                    console.log("ｘ:" + styleName);
                                }
                            }
                        } else {
                            if (attr.name === "href" && attr.value.indexOf(":") > -1) {
                                const schema = attr.value.match(/^(.*\:)/)[1];
                                if(schema.length > 0 && schemaWhiteList.indexOf(schema) > -1) {
                                    newNode.setAttribute(attr.name, attr.value);
                                    console.log("〇：" + attr.name);
                                } else {
                                    console.log("ｘ:" + attr.name);
                                }
                            } else {
                                newNode.setAttribute(attr.name, attr.value);
                            }
                        }
                    }
                }

                for (const childNode of node.childNodes) {
                    let subCopy = makeSanitizedCopy(childNode);
                    newNode.appendChild(subCopy, false);
                }
            }
        } else {
            if(node.nodeType == Node.ELEMENT_NODE) {
                console.log("ｘ:" + node.tagName);
            }
            newNode = document.createDocumentFragment();
        }
        return newNode;
    };
    console.groupCollapsed("HTML/CSSサニタイズ");
    let resultElement = makeSanitizedCopy(iframedoc.body);
    console.groupEnd();
    document.body.removeChild(iframe);
    return resultElement.innerHTML
}
