document.filter = ["HIGH", "MEDIUM", "LOW"];

function postMessage(message, data) {
    if (window.chrome.webview === undefined) {
        console.log("Missing webview ", message, data);
        return;
    }
    console.log("PostMessage", message, data);
    window.chrome.webview.postMessage({ message, data });
}

async function handleMessage(event) {
    console.log(event);
    const { message, data } = event.data;
    if (message === "refreshData") {
        await refreshData();
    } else if (message === "start") {
        document.getElementById("loading").classList.remove("hidden");
        document.getElementById("ready").classList.add("hidden");
    } else if (message === "end") {
        document.getElementById("loading").classList.add("hidden");
        document.getElementById("ready").classList.remove("hidden");
    }
}

if (window.chrome.webview !== undefined) {
    window.chrome.webview.addEventListener("message", handleMessage);
}


function getRule(path, rules) {
    for (const rule of rules) {
        if (rule.path == path) {
            return rule;
        }
    }
}

function flattenTestCase(testsuite, testcase, rules) {
    const rule = getRule(testsuite.name, rules);
    let status = "pass";
    let statusClass = "pico-background-cyan";
    if (rule.skipReason != "") {
        status = "skip";
        statusClass = "pico-background-slate";
    }
    if (testcase.failure) {
        status = "fail";
        statusClass = "pico-background-orange";
    }
    testcase.rule = rule;
    testcase.status = status;
    testcase.statusClass = statusClass;
    // clean up name
    let modelsource = "modelsource\\";
    if (testcase.name.startsWith(modelsource)) {
        testcase.name = testcase.name.substring(modelsource.length);
    }
    return testcase;
}

function createSpan(text, className) {
    let span = document.createElement("span");
    span.innerText = text;
    if (className !== undefined) {
        span.classList.add(className);
    }
    return span;
}

function createLink(text, href, obj) {
    let a = document.createElement("a");
    a.innerText = text;
    a.href = href;
    if (obj !== undefined) {
        a.addEventListener('click', (e) => {
            postMessage("openDocument", {
                document: obj.docname,
                type: obj.doctype,
                module: obj.module
            });
            e.preventDefault();
        });
    }
    return a;
}

function renderTestCase(testcase) {
    let tr = document.createElement("tr");
    let tdSeverity = document.createElement("td");
    tdSeverity.setAttribute("data-label", "Severity");
    let tdDocument = document.createElement("td");
    tdDocument.setAttribute("data-label", "Document");
    let tdModule = document.createElement("td");
    tdModule.setAttribute("data-label", "Module");
    let tdDocType = document.createElement("td");
    tdDocType.setAttribute("data-label", "Type");
    let tdRuleName = document.createElement("td");
    tdRuleName.setAttribute("data-label", "Rule");
    let tdCategory = document.createElement("td");
    tdCategory.setAttribute("data-label", "Category");
    let tdStatus = document.createElement("td");
    tdStatus.setAttribute("data-label", "Status");

    let details = document.createElement("details");
    let summary = document.createElement("summary");
    summary.innerText = testcase.rule.ruleName;
    details.appendChild(summary);

    let pDescription = document.createElement("p");
    let title = document.createElement("strong");
    title.innerText = testcase.rule.title;
    let description = document.createElement("span");
    description.innerText = testcase.rule.description;


    pDescription.appendChild(title);
    pDescription.appendChild(document.createElement("br"));
    pDescription.appendChild(description);
    details.appendChild(pDescription);

    let pRemediation = document.createElement("p");
    let remediation = document.createElement("strong");
    remediation.innerText = "Remediation";
    let remediationDescription = document.createElement("span");
    remediationDescription.innerText = testcase.rule.remediation;
    pRemediation.appendChild(remediation);
    pRemediation.appendChild(document.createElement("br"));
    pRemediation.appendChild(remediationDescription);
    pRemediation.classList.add("pico-color-blue");
    details.appendChild(pRemediation);

    if (testcase.status === "fail") {
        let pError = document.createElement("p");
        let error = document.createElement("strong");
        error.innerText = "Error";
        let errorDescription = document.createElement("span");
        errorDescription.innerText = testcase.failure.message;
        pError.appendChild(error);
        pError.appendChild(document.createElement("br"));
        pError.appendChild(errorDescription);
        pError.classList.add("pico-color-orange");
        details.appendChild(pError);
    }


    let spanStatus = document.createElement("span");
    spanStatus.innerText = testcase.status;
    spanStatus.classList.add("label");
    spanStatus.classList.add(testcase.statusClass);
    spanStatus.addEventListener('click', () => {
        postMessage("openDocument", { document: testcase.name });
    });

    tdSeverity.replaceChildren(createSpan(testcase.rule.severity));

    if (testcase.docname === "Metadata" && testcase.doctype === "") {
        tdDocument.replaceChildren(createSpan(testcase.docname));
    } else if (testcase.docname === "Security$ProjectSecurity" && testcase.doctype === "") {
        tdDocument.replaceChildren(createSpan(testcase.docname));
    } else {
        tdDocument.replaceChildren(createLink(testcase.docname, "#", testcase));
    }

    tdRuleName.replaceChildren(details);
    tdCategory.replaceChildren(createSpan(testcase.rule.category));
    tdDocType.replaceChildren(createSpan(testcase.doctype));
    tdModule.replaceChildren(createSpan(testcase.module));
    tdStatus.replaceChildren(spanStatus);

    tr.appendChild(tdSeverity);
    tr.appendChild(tdDocument);
    tr.appendChild(tdModule);
    tr.appendChild(tdDocType);
    tr.appendChild(tdRuleName);
    tr.appendChild(tdCategory);
    tr.appendChild(tdStatus);
    return tr;
}

function renderData() {
    let details = document.getElementById("testcases");

    let ruleItems = [];
    let pass = 0;
    let skip = 0;
    let fail = 0;
    let total = 0;
    let all_testcases = [];
    let data = document.data;

    for (const testsuite of data.testsuites) {
        let testcases = testsuite.testcases;
        for (const testcase of testcases) {
            let ts = flattenTestCase(testsuite, testcase, data.rules);
            if (ts.status === "fail") {
                fail++;
                ts.status_code = 1;
            } else if (ts.status === "skip") {
                skip++;
                ts.status_code = 2;
            } else {
                pass++;
                ts.status_code = 3;
            }
            if (ts.rule.severity === "HIGH") {
                ts.severity_code = 1;
            } else if (ts.rule.severity === "MEDIUM") {
                ts.severity_code = 2;
            } else {
                ts.severity_code = 3;
            }
            const tokens = ts.name.split("\\");
            //console.log(tokens);
            ts.module = "";
            if (tokens.length > 1) {
                ts.module = tokens[0];
                const last = tokens.length - 1;
                const rest = tokens.slice(1, tokens.length);
                //console.log(rest);
                if (rest.length > 1) {
                    ts.docname = rest.join("/").split('.')[0];
                    ts.doctype = tokens[last].split('.')[1];
                } else {
                    ts.docname = tokens[last].split('.')[0]
                    ts.doctype = "";
                }
            } else {
                ts.docname = ts.name.split('.')[0];
                ts.doctype = "";

            }
            all_testcases.push(ts);
        }
    }

    let testcases_filtered = all_testcases.filter((ts) => document.filter.includes(ts.rule.severity));

    let testcases_sorted = testcases_filtered.sort((a, b) => {
        return a.status_code - b.status_code || a.severity_code - b.severity_code;
    });

    for (const ts of testcases_sorted) {
        let tr = renderTestCase(ts);
        ruleItems.push(tr);
    }
    let rules = data.rules.length;

    total = pass + skip + fail;
    let passWidth = (pass / total) * 100;
    let skipWidth = (skip / total) * 100;
    let failWidth = (fail / total) * 100;
    document.getElementById("summaryPass").style = "width: " + passWidth + "%;";
    document.getElementById("summarySkip").style = "width: " + skipWidth + "%;";
    document.getElementById("summaryFail").style = "width: " + failWidth + "%;";

    document.getElementById("pass").innerText = pass;
    document.getElementById("skip").innerText = skip;
    document.getElementById("fail").innerText = fail;
    document.getElementById("total").innerText = total;
    document.getElementById("rules").innerText = rules;


    if (total === 0) {
        console.log("No testcases found");
    } else {
        details.replaceChildren(...ruleItems);
    }
}


function djb2(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash;
}

async function refreshData() {
    let response;
    if (window.chrome.webview === undefined) {
        response = await fetch("./api-sample.json");
    } else {
        response = await fetch("./api");
    }
    document.data = await response.json();
    let text = JSON.stringify(document.data);
    const newHash = djb2(text);
    if (document.hash !== newHash) {
        console.log("Data changed");
        renderData();
    }
    document.hash = newHash;
}

function setupFilters() {
    const severityFilter = document.getElementById('severityFilter');
    const statusFilter = document.getElementById('statusFilter');
    const documentFilter = document.getElementById('documentFilter');
    const moduleFilter = document.getElementById('moduleFilter');
    const typeFilter = document.getElementById('typeFilter');
    const ruleFilter = document.getElementById('ruleFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const resetFiltersButton = document.getElementById('resetFilters');
    const tableBody = document.getElementById('testcases');

    function filterTable() {
        const severityValue = severityFilter.value.toUpperCase();
        const statusValue = statusFilter.value.toLowerCase();
        const documentValue = documentFilter.value.toLowerCase();
        const moduleValue = moduleFilter.value.toLowerCase();
        const typeValue = typeFilter.value.toLowerCase();
        const ruleValue = ruleFilter.value.toLowerCase();
        const categoryValue = categoryFilter.value.toLowerCase();

        Array.from(tableBody.getElementsByTagName('tr')).forEach(row => {
            const severityCell = row.cells[0].textContent.toUpperCase();
            const documentCell = row.cells[1].textContent.toLowerCase();
            const moduleCell = row.cells[2].textContent.toLowerCase();
            const typeCell = row.cells[3].textContent.toLowerCase();
            const ruleCell = row.cells[4].textContent.toLowerCase();
            const categoryCell = row.cells[5].textContent.toLowerCase();
            const statusCell = row.cells[6].textContent.toLowerCase();

            const matchesSeverity = !severityValue || severityCell === severityValue;
            const matchesStatus = !statusValue || statusCell === statusValue;
            const matchesDocument = !documentValue || documentCell.includes(documentValue);
            const matchesModule = !moduleValue || moduleCell.includes(moduleValue);
            const matchesType = !typeValue || typeCell.includes(typeValue);
            const matchesRule = !ruleValue || ruleCell.includes(ruleValue);
            const matchesCategory = !categoryValue || categoryCell.includes(categoryValue);

            row.style.display = matchesSeverity && matchesStatus && matchesDocument && matchesModule && matchesType && matchesRule && matchesCategory ? '' : 'none';
        });
    }

    function resetFilters() {
        severityFilter.value = '';
        statusFilter.value = '';
        documentFilter.value = '';
        moduleFilter.value = '';
        typeFilter.value = '';
        ruleFilter.value = '';
        categoryFilter.value = '';
        filterTable();
    }

    severityFilter.addEventListener('change', filterTable);
    statusFilter.addEventListener('change', filterTable);
    documentFilter.addEventListener('input', filterTable);
    moduleFilter.addEventListener('input', filterTable);
    typeFilter.addEventListener('input', filterTable);
    ruleFilter.addEventListener('input', filterTable);
    categoryFilter.addEventListener('input', filterTable);
    resetFiltersButton.addEventListener('click', resetFilters);
}

function init() {
    document.hash = "";
    document.data = {
        "testsuites": [],
        "rules": []
    }
    if (window.chrome.webview === undefined) {
        refreshData();
    }
    renderData();
    setupFilters();
}


document.getElementById("toggleDebug").addEventListener("click", () => {
    let hidden = document.getElementById("debug").classList.contains("hidden");
    if (hidden) {
        document.getElementById("debug").classList.remove("hidden");
    } else {
        document.getElementById("debug").classList.add("hidden");
    }
    postMessage("toggeDebug");

});

init();

postMessage("MessageListenerRegistered");
setInterval(async () => {
    postMessage("refreshData");

    await refreshData();
}, 1000);