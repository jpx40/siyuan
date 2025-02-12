import {transaction} from "../../wysiwyg/transaction";
import {hasClosestBlock, hasClosestByClassName} from "../../util/hasClosest";
import {openMenuPanel} from "./openMenuPanel";
import {updateAttrViewCellAnimation} from "./action";
import {isNotCtrl} from "../../util/compatibility";
import {objEquals} from "../../../util/functions";
import {fetchPost} from "../../../util/fetch";
import {focusBlock, focusByRange} from "../../util/selection";
import * as dayjs from "dayjs";
import {unicode2Emoji} from "../../../emoji";
import {getColIconByType} from "./col";
import {genAVValueHTML} from "./blockAttr";
import {Constants} from "../../../constants";
import {hintRef} from "../../hint/extend";

export const getCellText = (cellElement: HTMLElement | false) => {
    if (!cellElement) {
        return "";
    }
    let cellText = "";
    const textElements = cellElement.querySelectorAll(".b3-chip, .av__celltext--ref, .av__celltext");
    if (textElements.length > 0) {
        textElements.forEach(item => {
            if (item.querySelector(".av__cellicon")) {
                cellText += `${item.firstChild.textContent} → ${item.lastChild.textContent}, `;
            } else if (item.getAttribute("data-type") !== "block-more") {
                cellText += item.textContent + ", ";
            }
        });
        cellText = cellText.substring(0, cellText.length - 2);
    } else {
        cellText = cellElement.textContent;
    }
    return cellText;
};

export const genCellValueByElement = (colType: TAVCol, cellElement: HTMLElement) => {
    const cellValue: IAVCellValue = {
        type: colType,
        id: cellElement.dataset.id,
    };
    if (colType === "number") {
        const value = cellElement.querySelector(".av__celltext").getAttribute("data-content");
        cellValue.number = {
            content: parseFloat(value) || 0,
            isNotEmpty: !!value
        };
    } else if (["text", "block", "url", "phone", "email", "template"].includes(colType)) {
        const textElement = cellElement.querySelector(".av__celltext") as HTMLElement;
        cellValue[colType as "text"] = {
            content: textElement.textContent
        };
        if (colType === "block" && textElement.dataset.id) {
            cellValue.block.id = textElement.dataset.id;
        }
    } else if (colType === "mSelect" || colType === "select") {
        const mSelect: IAVCellSelectValue[] = [];
        cellElement.querySelectorAll(".b3-chip").forEach((item: HTMLElement) => {
            mSelect.push({
                content: item.textContent.trim(),
                color: item.style.color.replace("var(--b3-font-color", "").replace(")", "")
            });
        });
        cellValue.mSelect = mSelect;
    } else if (["date", "created", "updated"].includes(colType)) {
        cellValue[colType as "date"] = JSON.parse(cellElement.querySelector(".av__celltext").getAttribute("data-value"));
    } else if (colType === "checkbox") {
        cellValue.checkbox = {
            checked: cellElement.querySelector("use").getAttribute("xlink:href") === "#iconCheck" ? true : false
        };
    } else if (colType === "relation") {
        cellValue.relation = {
            blockIDs: Array.from(cellElement.querySelectorAll("span")).map((item: HTMLElement) => item.getAttribute("data-id")),
            contents: Array.from(cellElement.querySelectorAll("span")).map((item: HTMLElement) => item.textContent),
        };
    } else if (colType === "mAsset") {
        const mAsset: IAVCellAssetValue[] = [];
        Array.from(cellElement.children).forEach((item) => {
            if (item.classList.contains("av__drag-fill")) {
                return;
            }
            const isImg = item.classList.contains("av__cellassetimg");
            mAsset.push({
                type: isImg ? "image" : "file",
                content: isImg ? item.getAttribute("src") : item.getAttribute("data-url"),
                name: isImg ? "" : item.textContent
            });
        });
        cellValue.mAsset = mAsset;
    }
    if (colType === "block") {
        cellValue.isDetached = cellElement.dataset.detached === "true";
    }
    return cellValue;
};

export const genCellValue = (colType: TAVCol, value: string | any) => {
    let cellValue: IAVCellValue = {
        type: colType,
        [colType === "select" ? "mSelect" : colType]: value as IAVCellDateValue
    };
    if (typeof value === "string" && value && colType !== "mAsset") {
        if (colType === "number") {
            cellValue = {
                type: colType,
                number: {
                    content: parseFloat(value) || 0,
                    isNotEmpty: true
                }
            };
        } else if (["text", "block", "url", "phone", "email", "template"].includes(colType)) {
            cellValue = {
                type: colType,
                [colType]: {
                    content: value
                }
            };
        } else if (colType === "mSelect" || colType === "select") {
            cellValue = {
                type: colType,
                mSelect: [{
                    content: value,
                    color: "1"
                }]
            };
        } else if (colType === "checkbox") {
            cellValue = {
                type: colType,
                checkbox: {
                    checked: true
                }
            };
        } else if (colType === "date") {
            cellValue = {
                type: colType,
                date: {
                    content: null,
                    isNotEmpty: false,
                    content2: null,
                    isNotEmpty2: false,
                    hasEndDate: false,
                    isNotTime: true,
                }
            };
        }
    } else if (typeof value === "undefined" || !value) {
        if (colType === "number") {
            cellValue = {
                type: colType,
                number: {
                    content: null,
                    isNotEmpty: false
                }
            };
        } else if (["text", "block", "url", "phone", "email", "template"].includes(colType)) {
            cellValue = {
                type: colType,
                [colType]: {
                    content: ""
                }
            };
        } else if (colType === "mSelect" || colType === "select" || colType === "mAsset") {
            cellValue = {
                type: colType,
                [colType === "select" ? "mSelect" : colType]: []
            };
        } else if (["date", "created", "updated"].includes(colType)) {
            cellValue = {
                type: colType,
                [colType]: {
                    content: null,
                    isNotEmpty: false,
                    content2: null,
                    isNotEmpty2: false,
                    hasEndDate: false,
                    isNotTime: true,
                }
            };
        } else if (colType === "checkbox") {
            cellValue = {
                type: colType,
                checkbox: {
                    checked: false
                }
            };
        } else if (colType === "relation") {
            cellValue = {
                type: colType,
                relation: {blockIDs: [], contents: []}
            };
        }
    }
    if (colType === "block") {
        cellValue.isDetached = true;
    }
    return cellValue;
};

export const cellScrollIntoView = (blockElement: HTMLElement, cellElement: Element, onlyHeight = true) => {
    const cellRect = cellElement.getBoundingClientRect();
    if (!onlyHeight) {
        const avScrollElement = blockElement.querySelector(".av__scroll");
        if (avScrollElement) {
            const avScrollRect = avScrollElement.getBoundingClientRect();
            if (avScrollRect.right < cellRect.right) {
                avScrollElement.scrollLeft = avScrollElement.scrollLeft + cellRect.right - avScrollRect.right;
            } else {
                const rowElement = hasClosestByClassName(cellElement, "av__row");
                if (rowElement) {
                    const stickyElement = rowElement.querySelector(".av__colsticky");
                    if (stickyElement) {
                        const stickyRight = stickyElement.getBoundingClientRect().right;
                        if (stickyRight > cellRect.left) {
                            avScrollElement.scrollLeft = avScrollElement.scrollLeft + cellRect.left - stickyRight;
                        }
                    } else if (avScrollRect.left > cellRect.left) {
                        avScrollElement.scrollLeft = avScrollElement.scrollLeft + cellRect.left - avScrollRect.left;
                    }
                }
            }
        }
    }
    if (!blockElement.querySelector(".av__header")) {
        // 属性面板
        return;
    }
    const avHeaderRect = blockElement.querySelector(".av__row--header").getBoundingClientRect();
    if (avHeaderRect.bottom > cellRect.top) {
        const contentElement = hasClosestByClassName(blockElement, "protyle-content", true);
        if (contentElement) {
            contentElement.scrollTop = contentElement.scrollTop + cellRect.top - avHeaderRect.bottom;
        }
    } else {
        const footerElement = blockElement.querySelector(".av__row--footer");
        if (footerElement.querySelector(".av__calc--ashow")) {
            const avFooterRect = footerElement.getBoundingClientRect();
            if (avFooterRect.top < cellRect.bottom) {
                const contentElement = hasClosestByClassName(blockElement, "protyle-content", true);
                if (contentElement) {
                    contentElement.scrollTop = contentElement.scrollTop + cellRect.bottom - avFooterRect.top;
                }
            }
        } else {
            const contentElement = hasClosestByClassName(blockElement, "protyle-content", true);
            if (contentElement) {
                const contentBottom = contentElement.getBoundingClientRect().bottom;
                if (cellRect.bottom > contentBottom) {
                    contentElement.scrollTop = contentElement.scrollTop + (cellRect.bottom - contentBottom);
                }
            }
        }
    }
};

export const getTypeByCellElement = (cellElement: Element) => {
    const scrollElement = hasClosestByClassName(cellElement, "av__scroll");
    if (!scrollElement) {
        return;
    }
    return scrollElement.querySelector(".av__row--header").querySelector(`[data-col-id="${cellElement.getAttribute("data-col-id")}"]`).getAttribute("data-dtype") as TAVCol;
};

export const popTextCell = (protyle: IProtyle, cellElements: HTMLElement[], type?: TAVCol) => {
    if (cellElements.length === 0 || (cellElements.length === 1 && !cellElements[0])) {
        return;
    }
    if (!type) {
        type = getTypeByCellElement(cellElements[0]);
    }
    if (type === "updated" || type === "created" || document.querySelector(".av__mask")) {
        return;
    }
    if (type === "block" && (cellElements.length > 1 || !cellElements[0].getAttribute("data-detached"))) {
        return;
    }
    const blockElement = hasClosestBlock(cellElements[0]);
    if (!blockElement) {
        return;
    }
    let cellRect = cellElements[0].getBoundingClientRect();
    /// #if MOBILE
    const contentElement = hasClosestByClassName(blockElement, "protyle-content", true);
    if (contentElement) {
        contentElement.scrollTop = contentElement.scrollTop + cellRect.top - 110;
    }
    /// #else
    cellScrollIntoView(blockElement, cellElements[0], false);
    /// #endif
    cellRect = cellElements[0].getBoundingClientRect();
    let html = "";
    const style = `style="padding-top: 6.5px;position:absolute;left: ${cellRect.left}px;top: ${cellRect.top}px;width:${Math.max(cellRect.width, 25)}px;height: ${cellRect.height}px"`;
    if (["text", "url", "email", "phone", "block", "template"].includes(type)) {
        html = `<textarea ${style} class="b3-text-field">${cellElements[0].firstElementChild.textContent}</textarea>`;
    } else if (type === "number") {
        html = `<input type="number" value="${cellElements[0].firstElementChild.getAttribute("data-content")}" ${style} class="b3-text-field">`;
    } else {
        if (["select", "mSelect"].includes(type)) {
            openMenuPanel({protyle, blockElement, type: "select", cellElements});
        } else if (type === "mAsset") {
            openMenuPanel({protyle, blockElement, type: "asset", cellElements});
            focusBlock(blockElement);
        } else if (type === "date") {
            openMenuPanel({protyle, blockElement, type: "date", cellElements});
        } else if (type === "checkbox") {
            updateCellValueByInput(protyle, type, blockElement, cellElements);
        } else if (type === "relation") {
            openMenuPanel({protyle, blockElement, type: "relation", cellElements});
        } else if (type === "rollup") {
            openMenuPanel({protyle, blockElement, type: "rollup", cellElements, colId: cellElements[0].dataset.colId});
        }
        if (!hasClosestByClassName(cellElements[0], "custom-attr")) {
            cellElements[0].classList.add("av__cell--select");
        }
        return;
    }
    window.siyuan.menus.menu.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="av__mask" style="z-index: ${++window.siyuan.zIndex}">
    ${html}
</div>`);
    const avMaskElement = document.querySelector(".av__mask");
    const inputElement = avMaskElement.querySelector(".b3-text-field") as HTMLInputElement;
    if (inputElement) {
        inputElement.select();
        inputElement.focus();
        if (type === "template") {
            fetchPost("/api/av/renderAttributeView", {id: blockElement.dataset.avId}, (response) => {
                response.data.view.columns.find((item: IAVColumn) => {
                    if (item.id === cellElements[0].dataset.colId) {
                        inputElement.value = item.template;
                        inputElement.dataset.template = item.template;
                        return true;
                    }
                });
            });
        }
        if (type === "block") {
            inputElement.addEventListener("input", (event: InputEvent) => {
                if (Constants.BLOCK_HINT_KEYS.includes(inputElement.value.substring(0, 2))) {
                    protyle.toolbar.range = document.createRange();
                    if (!blockElement.contains(cellElements[0])) {
                        const rowElement = hasClosestByClassName(cellElements[0], "av__row") as HTMLElement;
                        if (cellElements[0]) {
                            cellElements[0] = blockElement.querySelector(`.av__row[data-id="${rowElement.dataset.id}"] .av__cell[data-col-id="${cellElements[0].dataset.colId}"]`) as HTMLElement;
                        }
                    }
                    protyle.toolbar.range.selectNodeContents(cellElements[0].lastChild);
                    focusByRange(protyle.toolbar.range);
                    cellElements[0].classList.add("av__cell--select");
                    hintRef(inputElement.value.substring(2), protyle, "av");
                    avMaskElement?.remove();
                    event.preventDefault();
                    event.stopPropagation();
                }
            });
        }
        inputElement.addEventListener("keydown", (event) => {
            if (event.isComposing) {
                return;
            }
            if (event.key === "Escape" || event.key === "Tab" ||
                (event.key === "Enter" && !event.shiftKey && isNotCtrl(event))) {
                updateCellValueByInput(protyle, type, blockElement, cellElements);
                if (event.key === "Tab") {
                    protyle.wysiwyg.element.dispatchEvent(new KeyboardEvent("keydown", {
                        shiftKey: event.shiftKey,
                        ctrlKey: event.ctrlKey,
                        altKey: event.altKey,
                        metaKey: event.metaKey,
                        key: "Tab",
                        keyCode: 9
                    }));
                }
                event.preventDefault();
                event.stopPropagation();
            }
        });
    }
    avMaskElement.addEventListener("click", (event) => {
        if ((event.target as HTMLElement).classList.contains("av__mask")) {
            updateCellValueByInput(protyle, type, blockElement, cellElements);
            avMaskElement?.remove();
        }
    });
};

const updateCellValueByInput = (protyle: IProtyle, type: TAVCol, blockElement: HTMLElement, cellElements: HTMLElement[]) => {
    const rowElement = hasClosestByClassName(cellElements[0], "av__row");
    if (!rowElement) {
        return;
    }
    if (cellElements.length === 1 && cellElements[0].dataset.detached === "true" && !rowElement.dataset.id) {
        return;
    }
    const avMaskElement = document.querySelector(".av__mask");
    const avID = blockElement.getAttribute("data-av-id");
    if (type === "template") {
        const colId = cellElements[0].getAttribute("data-col-id");
        const textElement = avMaskElement.querySelector(".b3-text-field") as HTMLInputElement;
        if (textElement.value !== textElement.dataset.template) {
            transaction(protyle, [{
                action: "updateAttrViewColTemplate",
                id: colId,
                avID,
                data: textElement.value,
                type: "template",
            }], [{
                action: "updateAttrViewColTemplate",
                id: colId,
                avID,
                data: textElement.dataset.template,
                type: "template",
            }]);
        }
    } else {
        updateCellsValue(protyle, blockElement, type === "checkbox" ? {
            checked: cellElements[0].querySelector("use").getAttribute("xlink:href") === "#iconUncheck"
        } : (avMaskElement.querySelector(".b3-text-field") as HTMLInputElement).value, cellElements);
    }
    if (!hasClosestByClassName(cellElements[0], "custom-attr")) {
        cellElements[0].classList.add("av__cell--select");
    }
    //  单元格编辑中 ctrl+p 光标定位
    if (!document.querySelector(".b3-dialog")) {
        focusBlock(blockElement);
    }
    document.querySelectorAll(".av__mask").forEach((item) => {
        item.remove();
    });
};

export const updateCellsValue = (protyle: IProtyle, nodeElement: HTMLElement, value?: any, cElements?: HTMLElement[]) => {
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];

    const avID = nodeElement.dataset.avId;
    const id = nodeElement.dataset.nodeId;
    let text = "";
    const json: IAVCellValue[] = [];
    let cellElements: Element[];
    if (cElements?.length > 0) {
        cellElements = cElements;
    } else {
        cellElements = Array.from(nodeElement.querySelectorAll(".av__cell--active, .av__cell--select"));
        if (cellElements.length === 0) {
            nodeElement.querySelectorAll(".av__row--select:not(.av__row--header)").forEach(rowElement => {
                rowElement.querySelectorAll(".av__cell").forEach(cellElement => {
                    cellElements.push(cellElement);
                });
            });
        }
    }

    cellElements.forEach((item: HTMLElement, elementIndex) => {
        const rowElement = hasClosestByClassName(item, "av__row");
        if (!rowElement) {
            return;
        }
        if (!nodeElement.contains(item)) {
            item = cellElements[elementIndex] = nodeElement.querySelector(`.av__row[data-id="${rowElement.dataset.id}"] .av__cell[data-col-id="${item.dataset.colId}"]`) as HTMLElement;
        }
        const type = getTypeByCellElement(item) || item.dataset.type as TAVCol;
        if (["created", "updated", "template", "rollup"].includes(type)) {
            return;
        }

        const rowID = rowElement.getAttribute("data-id");
        const cellId = item.getAttribute("data-id");
        const colId = item.getAttribute("data-col-id");

        text += getCellText(item) + " ";
        const oldValue = genCellValueByElement(type, item);
        json.push(oldValue);
        // relation 为全部更新，以下类型为添加
        if (type === "mAsset") {
            if (Array.isArray(value)) {
                value = oldValue.mAsset.concat(value);
            } else if (typeof value !== "undefined") {
                // 不传入为删除，传入字符串不进行处理
                return;
            }
        } else if (type === "mSelect") {
            // 不传入为删除
            if (typeof value === "string") {
                value = oldValue.mSelect.concat({
                    content: value,
                    color: (oldValue.mSelect.length + 1).toString()
                });
            }
        }
        const cellValue = genCellValue(type, value);
        cellValue.id = cellId;
        if ((cellValue.type === "date" && typeof cellValue.date === "string") ||
            (cellValue.type === "relation" && typeof cellValue.relation === "string")) {
            return;
        }
        if (objEquals(cellValue, oldValue)) {
            return;
        }
        doOperations.push({
            action: "updateAttrViewCell",
            id: cellId,
            avID,
            keyID: colId,
            rowID,
            data: cellValue
        });
        undoOperations.push({
            action: "updateAttrViewCell",
            id: cellId,
            avID,
            keyID: colId,
            rowID,
            data: oldValue
        });
        if (!hasClosestByClassName(cellElements[0], "custom-attr")) {
            updateAttrViewCellAnimation(item, cellValue);
        } else {
            item.innerHTML = genAVValueHTML(cellValue);
        }
    });
    if (doOperations.length > 0) {
        doOperations.push({
            action: "doUpdateUpdated",
            id,
            data: dayjs().format("YYYYMMDDHHmmss"),
        });
        undoOperations.push({
            action: "doUpdateUpdated",
            id,
            data: nodeElement.getAttribute("updated"),
        });
        transaction(protyle, doOperations, undoOperations);
    }
    return {text: text.substring(0, text.length - 1), json};
};

export const renderCellAttr = (cellElement: Element, value: IAVCellValue) => {
    if (value.type === "checkbox") {
        if (value.checkbox.checked) {
            cellElement.classList.add("av__cell-check");
            cellElement.classList.remove("av__cell-uncheck");
        } else {
            cellElement.classList.remove("av__cell-check");
            cellElement.classList.add("av__cell-uncheck");
        }
    } else if (value.type === "block") {
        cellElement.setAttribute("data-block-id", value.block.id || "");
        if (value.isDetached) {
            cellElement.setAttribute("data-detached", "true");
        }
    }
};

export const renderCell = (cellValue: IAVCellValue) => {
    let text = "";
    if (["text", "template"].includes(cellValue.type)) {
        text = `<span class="av__celltext">${cellValue ? (cellValue[cellValue.type as "text"].content || "") : ""}</span>`;
    } else if (["url", "email", "phone"].includes(cellValue.type)) {
        const urlContent = cellValue ? cellValue[cellValue.type as "url"].content : "";
        // https://github.com/siyuan-note/siyuan/issues/9291
        let urlAttr = "";
        if (cellValue.type === "url") {
            urlAttr = ` data-href="${urlContent}"`;
        }
        text = `<span class="av__celltext av__celltext--url" data-type="${cellValue.type}"${urlAttr}>${urlContent}</span>`;
    } else if (cellValue.type === "block") {
        if (cellValue?.isDetached) {
            text = `<span class="av__celltext">${cellValue.block.content || ""}</span>
<span class="b3-chip b3-chip--info b3-chip--small" data-type="block-more">${window.siyuan.languages.more}</span>`;
        } else {
            text = `<span data-type="block-ref" data-id="${cellValue.block.id}" data-subtype="s" class="av__celltext av__celltext--ref">${cellValue.block.content || "Untitled"}</span>
<span class="b3-chip b3-chip--info b3-chip--small popover__block" data-id="${cellValue.block.id}" data-type="block-more">${window.siyuan.languages.update}</span>`;
        }
    } else if (cellValue.type === "number") {
        text = `<span class="av__celltext" data-content="${cellValue?.number.isNotEmpty ? cellValue?.number.content : ""}">${cellValue?.number.formattedContent || cellValue?.number.content || ""}</span>`;
    } else if (cellValue.type === "mSelect" || cellValue.type === "select") {
        cellValue?.mSelect?.forEach((item) => {
            text += `<span class="b3-chip" style="background-color:var(--b3-font-background${item.color});color:var(--b3-font-color${item.color})">${item.content}</span>`;
        });
    } else if (cellValue.type === "date") {
        const dataValue = cellValue ? cellValue.date : null;
        text = `<span class="av__celltext" data-value='${JSON.stringify(dataValue)}'>`;
        if (dataValue && dataValue.isNotEmpty) {
            text += dayjs(dataValue.content).format(dataValue.isNotTime ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm");
        }
        if (dataValue && dataValue.hasEndDate && dataValue.isNotEmpty && dataValue.isNotEmpty2) {
            text += `<svg class="av__cellicon"><use xlink:href="#iconForward"></use></svg>${dayjs(dataValue.content2).format(dataValue.isNotTime ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm")}`;
        }
        text += "</span>";
    } else if (["created", "updated"].includes(cellValue.type)) {
        const dataValue = cellValue ? cellValue[cellValue.type as "date"] : null;
        text = `<span class="av__celltext" data-value='${JSON.stringify(dataValue)}'>`;
        if (dataValue && dataValue.isNotEmpty) {
            text += dayjs(dataValue.content).format("YYYY-MM-DD HH:mm");
        }
        text += "</span>";
    } else if (cellValue.type === "mAsset") {
        cellValue?.mAsset?.forEach((item) => {
            if (item.type === "image") {
                text += `<img class="av__cellassetimg" src="${item.content}">`;
            } else {
                text += `<span class="b3-chip av__celltext--url" data-url="${item.content}">${item.name}</span>`;
            }
        });
    } else if (cellValue.type === "checkbox") {
        text += `<svg class="av__checkbox"><use xlink:href="#icon${cellValue?.checkbox?.checked ? "Check" : "Uncheck"}"></use></svg>`;
    } else if (cellValue.type === "rollup") {
        cellValue?.rollup?.contents?.forEach((item) => {
            const rollupText = ["select", "mSelect", "mAsset", "checkbox", "relation"].includes(item.type) ? renderCell(item) : renderRollup(item);
            if (rollupText) {
                text += rollupText + ", ";
            }
        });
        if (text && text.endsWith(", ")) {
            text = text.substring(0, text.length - 2);
        }
    } else if (cellValue.type === "relation") {
        cellValue?.relation?.contents?.forEach((item, index) => {
            text += `<span class="av__celltext--ref" style="margin-right: 8px" data-id="${cellValue?.relation?.blockIDs[index]}">${item || "Untitled"}</span>`;
        });
    }
    if (["text", "template", "url", "email", "phone", "number", "date", "created", "updated"].includes(cellValue.type) &&
        cellValue && cellValue[cellValue.type as "url"].content) {
        text += `<span ${cellValue.type !== "number" ? "" : 'style="right:auto;left:5px"'} data-type="copy" class="block__icon"><svg><use xlink:href="#iconCopy"></use></svg></span>`;
    }
    return text;
};

const renderRollup = (cellValue: IAVCellValue) => {
    let text = "";
    if (["text"].includes(cellValue.type)) {
        text = cellValue ? (cellValue[cellValue.type as "text"].content || "") : "";
    } else if (["url", "email", "phone"].includes(cellValue.type)) {
        const urlContent = cellValue ? cellValue[cellValue.type as "url"].content : "";
        if (urlContent) {
            let urlAttr = "";
            if (cellValue.type === "url") {
                urlAttr = ` data-href="${urlContent}"`;
            }
            text = `<span class="av__celltext av__celltext--url" data-type="${cellValue.type}"${urlAttr}>${urlContent}</span>`;
        }
    } else if (cellValue.type === "block") {
        if (cellValue?.isDetached) {
            text = `<span class="av__celltext">${cellValue.block?.content || ""}</span>`;
        } else {
            text = `<span data-type="block-ref" data-id="${cellValue.block?.id}" data-subtype="s" class="av__celltext av__celltext--ref">${cellValue.block?.content || "Untitled"}</span>`;
        }
    } else if (cellValue.type === "number") {
        text = cellValue?.number.formattedContent || cellValue?.number.content.toString() || "";
    } else if (cellValue.type === "date") {
        const dataValue = cellValue ? cellValue.date : null;
        if (dataValue && dataValue.isNotEmpty) {
            text += dayjs(dataValue.content).format(dataValue.isNotTime ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm");
        }
        if (dataValue && dataValue.hasEndDate && dataValue.isNotEmpty && dataValue.isNotEmpty2) {
            text += `<svg class="av__cellicon"><use xlink:href="#iconForward"></use></svg>${dayjs(dataValue.content2).format(dataValue.isNotTime ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm")}`;
        }
        if (text) {
            text = `<span class="av__celltext">${text}</span>`;
        }
    }
    return text;
};

export const updateHeaderCell = (cellElement: HTMLElement, headerValue: {
    icon?: string,
    name?: string,
    pin?: boolean,
}) => {
    if (typeof headerValue.icon !== "undefined") {
        cellElement.dataset.icon = headerValue.icon;
        cellElement.querySelector(".av__cellheadericon").outerHTML = headerValue.icon ? unicode2Emoji(headerValue.icon, "av__cellheadericon", true) : `<svg class="av__cellheadericon"><use xlink:href="#${getColIconByType(cellElement.dataset.dtype as TAVCol)}"></use></svg>`;
    }
    if (typeof headerValue.name !== "undefined") {
        cellElement.querySelector(".av__celltext").textContent = headerValue.name;
    }
    if (typeof headerValue.pin !== "undefined") {
        const textElement = cellElement.querySelector(".av__celltext");
        if (headerValue.pin) {
            if (!cellElement.querySelector(".av__cellheadericon--pin")) {
                textElement.insertAdjacentHTML("afterend", '<svg class="av__cellheadericon av__cellheadericon--pin"><use xlink:href="#iconPin"></use></svg>');
            }
        } else {
            cellElement.querySelector(".av__cellheadericon--pin")?.remove();
        }
    }
};

export const getPositionByCellElement = (cellElement: HTMLElement) => {
    let rowElement = hasClosestByClassName(cellElement, "av__row");
    if (!rowElement) {
        return;
    }
    let rowIndex = -1;
    while (rowElement) {
        rowElement = rowElement.previousElementSibling as HTMLElement;
        rowIndex++;
    }
    let celIndex = -2;
    while (cellElement) {
        cellElement = cellElement.previousElementSibling as HTMLElement;
        if (cellElement && cellElement.classList.contains("av__colsticky")) {
            cellElement = cellElement.lastElementChild as HTMLElement;
        }
        celIndex++;
    }
    return {rowIndex, celIndex};
};

export const dragFillCellsValue = (protyle: IProtyle, nodeElement: HTMLElement, originData: {
    [key: string]: IAVCellValue[]
}, originCellIds: string[]) => {
    nodeElement.querySelector(".av__drag-fill")?.remove();
    const newData: { [key: string]: Array<IAVCellValue & { colId?: string, element?: HTMLElement }> } = {};
    nodeElement.querySelectorAll(".av__cell--active").forEach((item: HTMLElement) => {
        if (originCellIds.includes(item.dataset.id)) {
            return;
        }
        const rowElement = hasClosestByClassName(item, "av__row");
        if (!rowElement) {
            return;
        }
        if (!newData[rowElement.dataset.id]) {
            newData[rowElement.dataset.id] = [];
        }
        const value: IAVCellValue & {
            colId?: string,
            element?: HTMLElement
        } = genCellValueByElement(getTypeByCellElement(item), item);
        value.colId = item.dataset.colId;
        value.element = item;
        newData[rowElement.dataset.id].push(value);
    });
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    const avID = nodeElement.dataset.avId;
    const originKeys = Object.keys(originData);
    Object.keys(newData).forEach((rowID, index) => {
        newData[rowID].forEach((item, cellIndex) => {
            if (["rollup", "template", "created", "updated"].includes(item.type)) {
                return;
            }
            const data = originData[originKeys[index % originKeys.length]][cellIndex];
            data.id = item.id;
            const keyID = item.colId;
            if (data.type === "block") {
                data.isDetached = true;
                delete data.block.id;
            }
            doOperations.push({
                action: "updateAttrViewCell",
                id: item.id,
                avID,
                keyID,
                rowID,
                data
            });
            item.element.innerHTML = renderCell(data);
            renderCellAttr(item.element, data);
            delete item.colId;
            delete item.element;
            undoOperations.push({
                action: "updateAttrViewCell",
                id: item.id,
                avID,
                keyID,
                rowID,
                data: item
            });
        });
    });
    focusBlock(nodeElement);
    if (doOperations.length > 0) {
        transaction(protyle, doOperations, undoOperations);
    }
};
