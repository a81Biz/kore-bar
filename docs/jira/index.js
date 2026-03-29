
// Objeto global para acceder rápido a las historias por su clave
window.allIssuesMap = {};

// Lógica de Pestañas
function openTab(evt, tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

// --- Funciones para manejar la MODAL ---
function openIssueModal(issueKey) {
    const issue = window.allIssuesMap[issueKey];
    if (!issue) return;

    const modal = document.getElementById('issueModal');
    const modalBody = document.getElementById('modal-body');

    // Preparar Estatus y Categoría
    const statusCat = getStatusCategory(issue.fields.status.name);
    let badgeClass = statusCat === 'done' ? 'badge-done' : (statusCat === 'prog' ? 'badge-prog' : 'badge-todo');

    // Recopilar Comentarios y Resoluciones
    let commentsHtml = '';
    if (issue.renderedFields.comment && issue.renderedFields.comment.comments.length > 0) {
        commentsHtml = `<div class="modal-section-title">Hilos de Resolución y Comentarios (${issue.renderedFields.comment.comments.length})</div><div class="comments-section">`;
        issue.renderedFields.comment.comments.forEach(c => {
            commentsHtml += `
                        <div class="comment">
                            <div class="comment-header">
                                <span class="comment-author">${c.author.displayName}</span>
                                <span class="comment-date">${c.created}</span>
                            </div>
                            <div class="comment-body">${c.body}</div>
                        </div>
                    `;
        });
        commentsHtml += `</div>`;
    }

    // Construir el HTML detallado dentro de la modal
    modalBody.innerHTML = `
                <div class="modal-issue-header">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span style="color:var(--text-muted); font-size:0.9em;">${issue.key} / ${issue.fields.issuetype?.name || 'Tarea'}</span>
                        <span class="badge ${badgeClass}">${issue.fields.status.name}</span>
                    </div>
                    <h2 class="modal-issue-title">${issue.fields.summary}</h2>
                    ${issue.epicName ? `<div style="margin-top:10px;"><span class="epic-tag">Épica: ${issue.epicName}</span></div>` : ''}
                </div>
                
                <div class="modal-section-title">Descripción Completa</div>
                <div class="description-body">
                    ${issue.renderedFields.description || '<i>Sin descripción registrada.</i>'}
                </div>
                
                ${commentsHtml}
            `;

    modal.style.display = "block";
    // Bloquear scroll del body de fondo
    document.body.style.overflow = "hidden";
}

function closeModal() {
    const modal = document.getElementById('issueModal');
    modal.style.display = "none";
    // Restaurar scroll
    document.body.style.overflow = "auto";
}

// Cerrar modal al hacer clic fuera del panel central
window.onclick = function (event) {
    const modal = document.getElementById('issueModal');
    if (event.target == modal) {
        closeModal();
    }
}

// Cerrar modal con la tecla ESC
document.addEventListener('keydown', function (event) {
    if (event.key === "Escape") {
        closeModal();
    }
});


// --- Funciones de Renderizado Generales ---

function formatDate(dateStr) {
    if (!dateStr) return 'Sin fecha';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getStatusCategory(statusName) {
    const name = statusName.toLowerCase();
    if (name.includes('listo') || name.includes('finalizada') || name.includes('done')) return 'done';
    if (name.includes('progreso') || name.includes('curso') || name.includes('in progress')) return 'prog';
    return 'todo';
}

function parseJiraSprint(sprintField) {
    if (!sprintField || sprintField.length === 0) return null;
    let raw = sprintField[0];
    if (typeof raw === 'object' && raw.name) return raw;
    if (typeof raw === 'string') {
        const nameMatch = raw.match(/name=([^,]+)/);
        const startMatch = raw.match(/startDate=([^,]+)/);
        const endMatch = raw.match(/endDate=([^,]+)/);
        return {
            name: nameMatch ? nameMatch[1] : 'Sprint Desconocido',
            startDate: startMatch && startMatch[1] !== '<null>' ? startMatch[1] : null,
            endDate: endMatch && endMatch[1] !== '<null>' ? endMatch[1] : null
        };
    }
    return null;
}

// Renderizado de tarjeta individual (Compacta y Clickable)
function renderCard(issue, includeEpicTag = false) {
    const statusCat = getStatusCategory(issue.fields.status.name);
    let badgeClass = statusCat === 'done' ? 'badge-done' : (statusCat === 'prog' ? 'badge-prog' : 'badge-todo');

    // Importante: Clase 'clickable' y evento 'onclick'
    return `
                <div class="issue-card clickable" onclick="openIssueModal('${issue.key}')">
                    <div class="issue-header">
                        <div class="issue-title">
                            <span class="issue-key">${issue.key}</span> 
                            ${issue.fields.summary}
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                        <span class="badge ${badgeClass}">${issue.fields.status.name}</span>
                        ${includeEpicTag && issue.epicName ? `<span class="epic-tag" style="font-size:0.7em;">${issue.epicName}</span>` : ''}
                    </div>
                </div>
            `;
}

// Función Principal de Carga
async function loadData() {
    try {
        const response = await fetch('sgrm_completo.json');
        const data = await response.json();

        document.getElementById('loading').style.display = 'none';

        let epics = {};
        let sprintsMap = {};
        let minDate = new Date('2099-01-01');
        let maxDate = new Date('2000-01-01');

        // 1. Mapear todo y buscar Épicas
        data.issues.forEach(issue => {
            // Guardar en el mapa global
            window.allIssuesMap[issue.key] = issue;

            if (issue.fields.issuetype?.name === 'Epic') {
                epics[issue.key] = { data: issue, stories: [], name: issue.fields.summary };
            }
        });

        // 2. Procesar Historias
        data.issues.forEach(issue => {
            if (issue.fields.issuetype?.name === 'Epic') return;

            // Asignar a Épica
            let parentKey = issue.fields.parent?.key || issue.fields.customfield_10014;
            if (parentKey && epics[parentKey]) {
                epics[parentKey].stories.push(issue);
                issue.epicName = epics[parentKey].name.substring(0, 20); // Ref corta
            }

            // Asignar a Sprint
            let sprintInfo = parseJiraSprint(issue.fields.customfield_10020 || issue.fields.sprint);
            let sprintName = sprintInfo ? sprintInfo.name : 'Backlog (Sin Sprint)';

            if (!sprintsMap[sprintName]) {
                sprintsMap[sprintName] = { info: sprintInfo, todo: [], prog: [], done: [] };
                if (sprintInfo?.startDate && sprintInfo?.endDate) {
                    let sStart = new Date(sprintInfo.startDate);
                    let sEnd = new Date(sprintInfo.endDate);
                    if (sStart < minDate) minDate = sStart;
                    if (sEnd > maxDate) maxDate = sEnd;
                }
            }
            let cat = getStatusCategory(issue.fields.status.name);
            sprintsMap[sprintName][cat].push(issue);
        });

        // --- Renderizar Vistas ---

        // Épicas
        let epicsHtml = '';
        Object.values(epics).forEach(epic => {
            let storiesHtml = epic.stories.map(s => renderCard(s)).join('');
            epicsHtml += `
                        <details class="epic-group">
                            <summary class="epic-header">
                                <span class="epic-tag" style="margin-right:15px;">${epic.data.key}</span> 
                                <span>${epic.data.fields.summary} (${epic.stories.length})</span>
                            </summary>
                            <div class="epic-content">
                                ${storiesHtml || '<p style="color:#5e6c84;font-style:italic;">No hay tareas vinculadas.</p>'}
                            </div>
                        </details>
                    `;
        });
        document.getElementById('tab-epics').innerHTML = epicsHtml;

        // Tableros Kanban
        let boardHtml = '';
        Object.keys(sprintsMap).sort().forEach(sName => {
            let sData = sprintsMap[sName];
            let dateLabel = sData.info?.startDate ? `${formatDate(sData.info.startDate)} - ${formatDate(sData.info.endDate)}` : '';
            boardHtml += `
                        <div class="sprint-header">
                            <span>${sName}</span>
                            <span class="sprint-dates">${dateLabel}</span>
                        </div>
                        <div class="kanban-board">
                            <div class="kanban-col"><div class="kanban-col-title">Por Hacer (${sData.todo.length})</div>${sData.todo.map(i => renderCard(i, true)).join('')}</div>
                            <div class="kanban-col"><div class="kanban-col-title">En Curso (${sData.prog.length})</div>${sData.prog.map(i => renderCard(i, true)).join('')}</div>
                            <div class="kanban-col"><div class="kanban-col-title">Finalizado (${sData.done.length})</div>${sData.done.map(i => renderCard(i, true)).join('')}</div>
                        </div>
                    `;
        });
        document.getElementById('tab-sprints').innerHTML = boardHtml;

        // Cronograma
        if (minDate < maxDate) {
            let totalDuration = maxDate.getTime() - minDate.getTime();
            let timelineHtml = `<div class="timeline-container"><div class="timeline-dates-axis"><span>Inicio: ${formatDate(minDate)}</span><span>Fin: ${formatDate(maxDate)}</span></div>`;
            Object.keys(sprintsMap).forEach(sName => {
                let info = sprintsMap[sName].info;
                if (info?.startDate && info?.endDate) {
                    let startT = new Date(info.startDate).getTime();
                    let endT = new Date(info.endDate).getTime();
                    let leftPct = ((startT - minDate.getTime()) / totalDuration) * 100;
                    let widthPct = ((endT - startT) / totalDuration) * 100;
                    timelineHtml += `<div class="timeline-row"><div class="timeline-label">${sName}</div><div class="timeline-track"><div class="timeline-bar" style="left: ${leftPct}%; width: ${widthPct}%;">${formatDate(info.startDate)}</div></div></div>`;
                }
            });
            document.getElementById('tab-timeline').innerHTML = timelineHtml + '</div>';
        } else {
            document.getElementById('tab-timeline').innerHTML = '<p style="text-align:center; padding:30px; color:var(--text-muted);">Faltan datos de fechas en los Sprints para generar el cronograma.</p>';
        }

    } catch (error) {
        console.error(error);
        document.getElementById('loading').innerHTML = '<span style="color:red;">Error al cargar datos. Asegúrate de estar usando un servidor local y que el JSON exista.</span>';
    }
}

loadData();
