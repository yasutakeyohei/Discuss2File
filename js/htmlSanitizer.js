const htmlSanitizer = () => {
    const tagWhitelist = [
        'A','ABBR',
        'B', 'BLOCKQUOTE', 'BODY', 'BR',
        'CENTER', 'CODE',
        'DIV',
        'EM',
        'FONT',
        'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR',
        'I', 'IMG',
        'LABEL', 'LI',
        'OL',
        'P', 'PRE',
        'SMALL', 'SOURCE', 'SPAN', 'STRONG',
        'TABLE', 'TBODY', 'TR', 'TD', 'TH', 'THEAD',
        'UL', 'U',
        'VIDEO'
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
        'background-color',
        'color',
        'font-size',
        'font-weight',
        'text-align',
        'text-decoration'
    ];

    const schemaWhiteList = ['http:', 'https:'];
    
    const sanitizeHtml = (input) => {
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

                for (const attr of node.attributes) {
                    attributeLoop:
                    if(attributeWhitelist.indexOf(attr.name) > -1) {
						if(attr.name === "style") {
							for (const styleName of node.style) {
								if(cssWhitelist.indexOf(styleName) > -1) {
                                    newNode.style.setProperty(styleName, node.style.getPropertyValue(styleName));
                                }
							}
						} else {
							if (attr.name === "href" && attr.value.indexOf(":") > -1) {
                                for (const schema of schemaWhiteList) {
                                    if(attr.value.indexOf(schema) !== 0) continue attributeLoop;
                                }
							}
							newNode.setAttribute(attr.name, attr.value);
                        }
                    }
                }

				for (const childNode of node.childNodes) {
					let subCopy = makeSanitizedCopy(childNode);
					newNode.appendChild(subCopy, false);
				}
			} else {
				newNode = document.createDocumentFragment();
			}
			return newNode;
		};

		let resultElement = makeSanitizedCopy(iframedoc.body);
		document.body.removeChild(iframe);
		return resultElement.innerHTML
    }

}