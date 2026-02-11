/*********************************************/
/*         SETUP, SHOW ... MODAL             */
/*********************************************/

const HANDOVER_IMAGE_KEY = "[HANDOVER_IMAGE]";
const HANDOVER_IMAGES_KEY = "[HANDOVER_IMAGES]";

function ParseDetailAndImages(detail) {
    const raw = detail || '';

    const markerIndexMulti = raw.indexOf(HANDOVER_IMAGES_KEY);
    if (markerIndexMulti !== -1) {
        const detailText = raw.substring(0, markerIndexMulti).trimEnd();
        const imageText = raw.substring(markerIndexMulti + HANDOVER_IMAGES_KEY.length).trim();
        try {
            const list = JSON.parse(imageText);
            const imageUrls = Array.isArray(list) ? list.filter(u => typeof u === 'string' && u.trim() !== '') : [];
            return { detailText: detailText, imageUrls: imageUrls };
        }
        catch {
            return { detailText: detailText, imageUrls: [] };
        }
    }

    const markerIndexSingle = raw.indexOf(HANDOVER_IMAGE_KEY);
    if (markerIndexSingle !== -1) {
        const detailText = raw.substring(0, markerIndexSingle).trimEnd();
        const imageUrl = raw.substring(markerIndexSingle + HANDOVER_IMAGE_KEY.length).trim();
        return { detailText: detailText, imageUrls: imageUrl ? [imageUrl] : [] };
    }

    return { detailText: raw, imageUrls: [] };
}

function BuildDetailWithImages(detailText, imageUrls) {
    const text = (detailText || '').trim();
    const urls = Array.isArray(imageUrls) ? imageUrls.filter(u => typeof u === 'string' && u.trim() !== '') : [];

    if (urls.length < 1) {
        return text;
    }

    const imageJson = JSON.stringify(urls);
    if (!text) {
        return HANDOVER_IMAGES_KEY + imageJson;
    }

    return text + "\n" + HANDOVER_IMAGES_KEY + imageJson;
}

function RenderImageList(previewSelector, imageUrls, options = {}) {
    const previewElm = $(previewSelector);
    const canRemove = options.canRemove === true;
    const dataKey = options.dataKey || '';

    if (!Array.isArray(imageUrls) || imageUrls.length < 1) {
        previewElm.html('');
        previewElm.addClass('d-none');
        return;
    }

    let html = '<div class="d-flex flex-wrap gap-2">';
    $.each(imageUrls, function (index, url) {
        html += `<div class="border rounded p-1" style="width: 90px;">`;
        html += `<img src="${url}" style="width:100%;height:70px;object-fit:cover;cursor:pointer;" onclick="window.open('${url}','_blank')">`;
        if (canRemove) {
            html += `<button type="button" class="btn btn-sm btn-outline-danger w-100 mt-1" onclick="RemoveUploadedImage('${dataKey}', ${index})">Xóa</button>`;
        }
        html += `</div>`;
    });
    html += '</div>';

    previewElm.html(html);
    previewElm.removeClass('d-none');
}

function RemoveUploadedImage(dataKey, index) {
    const holder = $(`#${dataKey}`);
    let images = [];
    try {
        images = JSON.parse(holder.val() || '[]');
    }
    catch {
        images = [];
    }

    images.splice(index, 1);
    holder.val(JSON.stringify(images));

    if (dataKey === 'add_handoverImageUrls') {
        RenderImageList('#add_handoverImagePreview', images, { canRemove: true, dataKey: 'add_handoverImageUrls' });
    }
    if (dataKey === 'Edit2_handoverImageUrls') {
        RenderImageList('#Edit2_handoverImagePreview', images, { canRemove: true, dataKey: 'Edit2_handoverImageUrls' });
    }
}

function UploadHandoverImages(fileInputSelector, hiddenUrlsSelector, previewSelector) {
    const input = $(fileInputSelector)[0];
    if (!input || !input.files || input.files.length === 0) {
        return;
    }

    let existing = [];
    try {
        existing = JSON.parse($(hiddenUrlsSelector).val() || '[]');
    }
    catch {
        existing = [];
    }

    const files = Array.from(input.files);
    let pending = files.length;

    if (pending < 1) {
        return;
    }

    $.each(files, function (_, file) {
        const formData = new FormData();
        formData.append('file', file);

        $.ajax({
            url: '/Handover/Works/UploadHandoverImage',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (res) {
                if (res.success && res.fileUrl) {
                    existing.push(res.fileUrl);
                }
                else {
                    toastr["error"](res.error || 'Upload ảnh thất bại', 'SERVER ALERT');
                }
            },
            error: function () {
                toastr["error"]('Connect to server error! Please double check or contact', 'CONNECT ERROR');
            },
            complete: function () {
                pending--;
                if (pending === 0) {
                    $(hiddenUrlsSelector).val(JSON.stringify(existing));
                    RenderImageList(previewSelector, existing, { canRemove: true, dataKey: hiddenUrlsSelector.replace('#', '') });
                    toastr["success"]('Upload ảnh thành công');
                }
            }
        });
    });
}

function RenderDetailImageGallery(containerSelector, imageUrls) {
    if (!Array.isArray(imageUrls) || imageUrls.length < 1) {
        $(containerSelector).html('<span class="text-muted">Không có hình ảnh giao ca</span>');
        return;
    }

    let html = '<div class="d-flex flex-wrap gap-2 mb-2">';
    $.each(imageUrls, function (index, url) {
        html += `<img src="${url}" class="border rounded" style="width:72px;height:72px;object-fit:cover;cursor:pointer;" onclick="SetMainDetailImage('${containerSelector.replace('#', '')}', ${index})">`;
    });
    html += '</div>';
    html += `<div><img id="${containerSelector.replace('#', '')}_main" src="${imageUrls[0]}" style="max-width:100%;max-height:360px;border-radius:6px;cursor:pointer;" onclick="window.open(this.src,'_blank')"></div>`;

    $(containerSelector).data('images', imageUrls);
    $(containerSelector).html(html);
}

function SetMainDetailImage(containerId, index) {
    const holder = $(`#${containerId}`);
    const images = holder.data('images') || [];
    if (!images[index]) return;
    $(`#${containerId}_main`).attr('src', images[index]);
}

//create data to table
$(function () {
    $.ajax({
        type: "GET",
        url: "/Handover/Works/GetListWork",
        contentType: "application/json;charset=utf-8",
        dataType: "json",
        success: function (res) {
            dataTable.rows().remove('all');

            DrawUserList(res.infoUser, 'userRq_list');
            DrawUserList(res.infoUser, 'userRc_list');
            DrawModelList(res.modelList, 'models_list');
            DrawModelTableHead(res.modelList, 'ModelSelect');

            switch (res.status) {
                case 'success': {
                    toastr["success"]('Get datatable success!', 'DONE');
                    $.each(res.data, function (key, value) {
                        dataTable.rows().add(MakeOneRow(value));
                    });

                    return;
                }
                case 'fail': {
                    toastr["error"](res.err, 'SERVER ERROR');
                    return;
                }
                default: {
                    toastr["error"]('Opps!!! Data is null error.', 'ERROR');
                    return;
                }
            }
        },
        error: function (err) {
            toastr["error"]('Connect to server error', 'CONNECT ERROR');
            console.log(err);
        }
    });
});

$(document).on('change', '#add_handoverImage', function () {
    UploadHandoverImages('#add_handoverImage', '#add_handoverImageUrls', '#add_handoverImagePreview');
    $(this).val('');
});

$(document).on('change', '#Edit2_handoverImage', function () {
    UploadHandoverImages('#Edit2_handoverImage', '#Edit2_handoverImageUrls', '#Edit2_handoverImagePreview');
    $(this).val('');
});

// Event
{
    //  Show Add modal
    function AddModal_Open() {
        $("#add_startDate").val(GetDateToday());
        $("#add_dueDate").val(GetDateToday());

        $('#add_ownerRq').val(getCookie("UserCookies", "CardID"));
        $('#add_ownerRc').val('');


        $("#add_CTF").val($("#Add_CTF option:first").val());
        $("#add_Model").val('');
        $("#add_type").val($("#Add_Type option:first").val());

        $('#add_work').val('');
        $('#add_result').val('');
        $('#add_handoverImage').val('');
        $('#add_handoverImageUrls').val('[]');
        RenderImageList('#add_handoverImagePreview', [], { canRemove: true, dataKey: 'add_handoverImageUrls' });

        $('#add_modal').modal('show');
    }
    function AddModal_Save() {
        //Control data
        let data = {
            ID: null,
            DateStart: $('#add_startDate').val(),
            DueDate: $('#add_dueDate').val(),
            OwnerRequest: $('#add_ownerRq').val(),
            OwnerReceive: $('#add_ownerRc').val(),

            CTF: $('#add_CTF').val(),
            Model: $('#add_Model').val(),
            Type: $('#add_type').val(),
            Status: $('#add_status').val(),

            WorkDes: $('#add_work').val(),
            Detail: BuildDetailWithImages($('#add_result').val(), JSON.parse($('#add_handoverImageUrls').val() || '[]'))
        };
        if (!CheckData(data)) return;
        //Send to server
        $.ajax({
            url: "/Handover/Works/AddWork",
            data: JSON.stringify(data),
            type: "POST",
            contentType: "application/json;charset=utf-8",
            dataType: "json",
            success: function (res) {
                let dataRes = res.dataRow;
                if (res.success) {
                    toastr["success"](data.Type + ' | Create handouver work ' + data.OwnerRequest + ' to ' + data.OwnerReceive + ' success!');
                    dataTable.rows().add(MakeOneRow(dataRes));

                    DrawModelList(res.model, 'models_list');
                    DrawModelTableHead(res.model, 'ModelSelect');

                    $('#add_modal').modal('hide');
                }
                else {
                    toastr["error"](res.error, 'SERVER ALERT');
                }
            },
            error: function (err) {
                toastr["error"]('Connect to server error! Please double check or contact', 'CONNECT ERROR');
            }
        });
    }

    //  Show Edit Modal
    $(document).on("click", "[data-edit]", function (e) {
        e.preventDefault();
        this.blur();

        const role = getCookie("UserCookies", "Role");


        let id = $(this).data('edit');
        let index = $(this).parent().parent().index();
        let btn = document.getElementById('EditSaveBtn');
        btn.setAttribute('data-id', id);
        btn.setAttribute('data-index', index);

        $.ajax({
            type: "GET",
            url: "/Handover/Works/GetWork/" + id,
            contentType: "application/json;charset=utf-8",
            dataType: "json",
            success: function (res) {
                if (res.success) {
                    //Draw datalist
                    const data = res.data;

                    /* Check Permission*/
                    if (role == 3) {
                        const cookiesUser = getCookie("UserCookies", "CardID");
                        if (data.OwnerRequest != cookiesUser) {
                            let check = false;
                            $.each(data.OwnerReceive.split(','), function (k, v) {
                                if (v.trim() == cookiesUser) {
                                    check = true;
                                    return false;
                                }
                            });
                            if (!check) {
                                return;
                            }
                        }
                    }
                    /* End */

                    if (res.data.DueDate != null) {
                        $('#Edit2_Title').text(`EDIT WORK - ${data.ID}`)

                        $('#Edit2_StartDate').val(GetDateString(data.DateStart));
                        $('#Edit2_DueDate').val(GetDateString(data.DueDate));
                        $('#Edit2_OwnerRequest').val(data.OwnerRequest);
                        $('#Edit2_OwnerReceive').val(data.OwnerReceive);
                        $("#Edit2_CTF").val(data.CTF);
                        $("#Edit2_Model").val(data.Model);
                        $("#Edit2_Type").val(data.Type);
                        $("#Edit2_Status").val(data.Status);
                        $("#Edit2_Work").val(data.WorkDes);
                        const detailData = ParseDetailAndImages(data.Detail);
                        $("#Edit2_Result").val(detailData.detailText);
                        $('#Edit2_handoverImage').val('');
                        $('#Edit2_handoverImageUrls').val(JSON.stringify(detailData.imageUrls || []));
                        RenderImageList('#Edit2_handoverImagePreview', detailData.imageUrls || [], { canRemove: true, dataKey: 'Edit2_handoverImageUrls' });

                        $('#Edit2Modal').modal('show');
                    }
                    else {
                        resetModal('EditWorkModal');
                        const work = res.data;
                        document.getElementById('modalEditHead').innerHTML = 'EDIT WORK - ID: ' + work.ID;
                        document.getElementById('Edit_ID').value = work.ID;
                        document.getElementById('Edit_Date').value = GetDateString(work.DateStart);
                        let user1 = document.getElementById('Edit_UserReq');
                        let user2 = document.getElementById('Edit_UserRec');
                        user1.value = work.OwnerRequest;
                        user2.value = work.OwnerReceive;

                        if (work.OwnerRequest == getCookie('UserCookies', 'CardID') && getCookie('UserCookies', 'Role') != '1' && getCookie('UserCookies', 'Role') != '2') {
                            user1.disabled = true;
                        }
                        if (work.OwnerReceive == getCookie('UserCookies', 'CardID') && getCookie('UserCookies', 'Role') != '1' && getCookie('UserCookies', 'Role') != '2') {
                            user1.disabled = true;
                            user2.disabled = true;
                        }


                        $('#Edit_Status').val(work.Status);
                        $('#Edit_Type').val(work.Type);
                        const detailData = ParseDetailAndImages(work.Detail);
                        $('#Edit_Detail').val(detailData.detailText);
                        $('#Edit_Detail').data('image-urls', detailData.imageUrls || []);

                        { // Dynamic Input
                            let cardElm = document.getElementById('cardEdit');
                            let InMax = 0;
                            $.each(JSON.parse(work.WorkDes), function (key, value) {
                                let stringHtmlInputAdd =
                                    '<div class="row mb-3" data-EditModalCard="' + key + '">' +
                                    '<div class="col-11" >' +
                                    '<input type="text" class="form-control" data-InputEdit="' + key + '" value="' + value + '"></div>' +
                                    '<div class="col-1">';
                                stringHtmlInputAdd += '<button type = "button" class="btn btn-outline-danger" onclick = "DynamicEditRemove(' + key + ')">' +
                                    '<i class="bi bi-trash"></i>';
                                stringHtmlInputAdd += '</button></div></div>';
                                cardElm.innerHTML += stringHtmlInputAdd;
                                if (InMax < key) InMax = key;
                            });
                            InMax++;
                            const stringHtmlInputAdd =
                                '<div class="row mb-3" data-EditModalCard="' + InMax + '">' +
                                '<div class="col-11" >' +
                                '<input type="text" class="form-control" data-InputEdit="' + InMax + '" placeholder="Enter the work here...">' +
                                '</div>' +
                                '<div class="col-1">' +
                                '<button type = "button" class="btn btn-outline-success" onclick = "DynamicEditWork()" >' +
                                '<i class="bi bi-plus-lg"></i>' +
                                '</button>' +
                                '</div>' +
                                '</div>';
                            cardElm.insertAdjacentHTML('beforeend', stringHtmlInputAdd);
                        }

                        $('#EditWorkModal').modal('show');
                    }
                }
                else {
                    toastr["error"](res.error, 'SERVER ALRET');
                }
            },
            error: function (err) {
                toastr["error"]('Connect to server error! Please double check or contact', 'CONNECT ERROR');
            }
        });
    });
    function EditModal_Save() {
        const btn = document.getElementById('EditSaveBtn');
        let id = btn.getAttribute('data-id');
        let index = btn.getAttribute('data-index');
        //Control data
        let data;
        if ($('#Edit2_Title').text() == 'EDIT WORK - ' + id) {
            data = {
                ID: id,

                DateStart: $('#Edit2_StartDate').val(),
                DueDate: $('#Edit2_DueDate').val(),
                OwnerRequest: $('#Edit2_OwnerRequest').val(),
                OwnerReceive: $('#Edit2_OwnerReceive').val(),

                CTF: $('#Edit2_CTF').val(),
                Model: $('#Edit2_Model').val(),
                Type: $('#Edit2_Type').val(),
                Status: $('#Edit2_Status').val(),

                WorkDes: $('#Edit2_Work').val(),
                Detail: BuildDetailWithImages($('#Edit2_Result').val(), JSON.parse($('#Edit2_handoverImageUrls').val() || '[]'))
            }

        }
        else {
            data = {
                ID: $('#Edit_ID').val(),
                DateStart: $('#Edit_Date').val(),
                Type: $('#Edit_Type').val(),
                OwnerRequest: $('#Edit_UserReq').val(),
                OwnerReceive: $('#Edit_UserRec').val(),
                Status: $('#Edit_Status').val(),
                Detail: BuildDetailWithImages($('#Edit_Detail').val(), $('#Edit_Detail').data('image-urls') || [])
            }
            const workInput = [...document.querySelectorAll(`[data-InputEdit]`),];
            const arrLength = workInput.length;
            if (arrLength > 1) {
                data.WorkDes = '{';
                for (let i = 0; i < arrLength - 1; i++) {
                    if (i < arrLength - 2)
                        data.WorkDes += '"' + (i + 1) + '":"' + workInput[i].value.replace(/"/g, "'").replace(/\\'/g, "\'") + '",';
                    else
                        data.WorkDes += '"' + (i + 1) + '":"' + workInput[i].value.replace(/"/g, "'").replace(/\\'/g, "\'") + '"';
                }
                data.WorkDes += '}';
            }
            else {
                toastr["warning"]('Please click (+) button after enter work!', 'Work Null');
                return;
            }
        }

        const sendData = {
            work: data,
            changeTime: GetDateToday().replace('T', ' '),
            userChange: getCookie('UserCookies', 'CardID'),
        }
        //Send to server
        $.ajax({
            url: "/Handover/Works/EditWork",
            data: JSON.stringify(sendData),
            type: "POST",
            contentType: "application/json;charset=utf-8",
            dataType: "json",
            success: function (res) {
                if (res.success) {
                    let dataRes = res.dataRow;

                    dataTable.rows().updateRow(index, MakeOneRow(dataRes));
                    $('#Edit2Modal').modal('hide');
                    $('#EditWorkModal').modal('hide');

                    toastr["success"]('Update work success', dataRes.ID + ' | ' + GetDateString(dataRes.DateStart).replace('T', ' '));
                }
                else {
                    toastr["error"](res.error, 'SERVER ALRET');
                }
            },
            error: function () {
                toastr["error"]('Connect to server error! Please double check or contact', 'CONNECT ERROR');
            }
        });

    }

    //  Show Detele Modal
    $(document).on("click", "[data-delete]", function (e) {
        e.preventDefault();
        this.blur();
        const role = getCookie("UserCookies", "Role");

        let id = $(this).data('delete');
        let index = $(this).parent().parent().index();
        let btn = document.getElementById('deleteBtn');

        btn.setAttribute('data-id', id);
        btn.setAttribute('data-index', index);

        $.ajax({
            type: "GET",
            url: "/Handover/Works/GetWork/" + id,
            contentType: "application/json;charset=utf-8",
            dataType: "json",
            success: function (res) {
                if (res.success) {
                    const work = res.data;

                    /* Check Permission*/
                    if (role == 3) {
                        const cookiesUser = getCookie("UserCookies", "CardID");
                        if (work.OwnerRequest != cookiesUser) {
                            let check = false;
                            $.each(work.OwnerReceive.split(','), function (k, v) {
                                if (v.trim() == cookiesUser) {
                                    check = true;
                                    return false;
                                }
                            });
                            if (!check) {
                                return;
                            }
                        }
                    }
                    /* End */

                    $('#detail_ctf').text(work.CTF);
                    $('#detail_model').text(work.Model);
                    $('#detail_type').text(work.Type);
                    $('#detail_rq').text(work.OwnerRequest);
                    let textRc = '';
                    $('#detail_rc').text('');
                    $.each(work.OwnerReceive.split(','), function (k, v) {
                        textRc += v + '<br>';
                    });
                    $('#detail_rc').append(textRc);

                    $('#DeleteWorkModal').modal('show');
                }
                else {
                    toastr["error"](res.error, 'SERVER ALRET');
                }
            },
            error: function () {
                toastr["error"]('Connect to server error! Please double check or contact', 'CONNECT ERROR');
            }
        });
    });
    function DeteleWork() {
        const btn = document.getElementById('deleteBtn');
        let id = btn.getAttribute('data-id');
        let index = btn.getAttribute('data-index');

        $.ajax({
            type: "POST",
            url: "/Handover/Works/DeleteWork/" + id,
            dataType: "json",
            success: function (res) {
                if (res.success) {
                    toastr["success"]('Delete work success!', 'SUCCESS');
                    dataTable.rows().remove(index);
                    $('#DeleteWorkModal').modal('hide');
                    return;
                }
                else {
                    toastr["error"](res.error, 'SERVER ALRET');
                }
            },
            error: function () {
                toastr["error"]('Connect to server error! Please double check or contact', 'CONNECT ERROR');
            }
        });

    }

    //  Show Detail Modal
    $(document).on("click", "[data-detail]", function (e) {
        e.preventDefault;
        this.blur();
        const role = getCookie("UserCookies", "Role");

        let id = $(this).data('detail');

        $.ajax({
            type: "GET",
            url: "/Handover/Works/GetWork/" + id,
            contentType: "application/json;charset=utf-8",
            dataType: "json",
            success: function (res) {
                if (res.success) {
                    const work = res.data;
                    const userReq = JSON.parse(res.userReq);
                    const userRec = JSON.parse(res.userRec);

                    $('#details_ctf').text(work.CTF);
                    $('#details_model').text(work.Model);
                    $('#details_type').text(work.Type);
                    let ptext;
                    switch (work.Status) {
                        case 'On-going': {
                            ptext = `<p class="card-text badge rounded-pill bg-warning">On-going</p>`;
                            break;
                        }
                        case 'Done': {
                            ptext = `<p class="card-text badge rounded-pill bg-success">Done</p>`;
                            break;
                        }
                        case 'Open': {
                            ptext = `<p class="card-text badge rounded-pill bg-danger">Open</p>`;
                            break;
                        }
                        case 'Close': {
                            ptext = `<p class="card-text badge rounded-pill bg-secondary">Close</p>`;
                            break;
                        }
                    }
                    $('#details_status').html(ptext);

                    //Card Requester and Receiver
                    $('#details_cardid_rq').text(userReq[0].CardID);
                    $('#details_name_rq').text(userReq[0].CnName + ' | ' + userReq[0].VnName);
                    $('#details_depart_rq').text(userReq[0].Department);

                    $('#ownerRc_Card').html('');
                    $.each(userRec, function (k, v) {
                        let ownerRc_card = `<div class="fs-5" id="details_owner_rc">
                            <!---->
                            <div class="row" id="details_cardHead">
                                <p class="card-text">Owner receive ${k + 1}</p>
                            </div>
                            <!---->
                            <div class="row">
                                <div class="col-3">
                                    <p class="card-text">Card ID</p>
                                </div>
                                <div class="col-8">
                                    <p class="card-text" id="details_cardid_rc">${v.CardID}</p>
                                </div>
                            </div>
                            <!---->
                            <div class="row">
                                <div class="col-3">
                                    <p class="card-text">Name</p>
                                </div>
                                <div class="col-8">
                                    <p class="card-text" id="details_name_rc">${v.CnName} | ${v.VnName}</p>
                                </div>
                            </div>
                            <!---->
                            <div class="row">
                                <div class="col-3">
                                    <p class="card-text">Department</p>
                                </div>
                                <div class="col-8">
                                    <p class="card-text" id="details_depart_rc">${v.Department}</p>
                                </div>
                            </div>
                        </div>`;
                        $('#ownerRc_Card').append(ownerRc_card);
                    });

                    // Card Time
                    const p_time = `<label class="fw-bold text-success">${GetDateString(work.DateStart, 'DateTime')} </label>
                                              <label> - </label>
                                            <label class="fw-bold text-danger"> ${GetDateString(work.DueDate, 'DateTime')}</label>`;
                    $('#details_date').html(p_time);

                    //Card Work
                    let workHtmlText = '';
                    try {
                        $.each(JSON.parse(work.WorkDes), function (key, value) {
                            workHtmlText += `<p>${key}: ${value}`;
                        });
                    }
                    catch {
                        workHtmlText += work.WorkDes;
                    }
                    $('#details_work').html(workHtmlText);

                    //Card Result and Image
                    const detailsData = ParseDetailAndImages(work.Detail);
                    $('#details_result').html(detailsData.detailText);
                    RenderDetailImageGallery('#details_image', detailsData.imageUrls || []);

                    //Card History
                    let HistoryElm = document.getElementById('details_history');

                    HistoryElm.innerHTML = '';
                    let showHistory = true;
                    /* Check Permission*/
                    if (role == 3) {
                        if (work.OwnerRequest != getCookie("UserCookies", "CardID")) {
                            $.each(work.OwnerReceive.split(','), function (k, v) {
                                if (v.trim() == getCookie("UserCookies", "CardID")) {
                                    showHistory = true;
                                    return false;
                                } else {
                                    showHistory = false;
                                }
                            });
                        }
                    }
                    /* End */
                    if (showHistory) {
                        if (work.HistoryLog != null) {
                            let log = Object.entries(JSON.parse(work.HistoryLog)).reverse();
                            $.each(log, function (key, value) {
                                if (value[1].length > 0) {
                                    let html = '';
                                    html += '<div data-vtdate="<b>' + value[0] + '</b>">';
                                    $.each(value[1], function (k, v) {
                                        html += '<h5>Change: <b>' + v.Action + '</b></h5>';
                                        html += `<a href="/Dashboard/' + v.User + '">${v.User}</a>`;
                                        html += '<div class="row">'
                                        html += '<div class="col-3"><p>Before:</p></div>'
                                        html += '<div class="col-9"><p>' + clearJson(v.Old) + '</p></div></div>'
                                        html += '<div class="row">'
                                        html += '<div class="col-3"><b>After:</b></div>'
                                        html += '<div class="col-9"><p>' + clearJson(v.New) + '</p></div></div>'
                                    });
                                    html += '</div>';
                                    HistoryElm.innerHTML += html;
                                }
                            });
                            $('#details_history').verticalTimeline({
                                startLeft: false,
                                alternate: true,
                                animate: "Slide",
                                arrows: false
                            });
                        }
                    }
                    //Show Modal
                    $('#DetailWorkModal').modal('show');
                }
                else {
                    toastr["error"](res.error, 'SERVER ALRET');
                }
            },
            error: function () {
                toastr["error"]('Connect to server error! Please double check or contact', 'CONNECT ERROR');
            }
        });
    });
}
