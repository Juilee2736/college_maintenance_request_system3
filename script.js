/* =========================================================
   COLLEGE MAINTENANCE REQUEST SYSTEM
========================================================= */

const REQUEST_KEY = "cCollege Maintenance_requests";
const USER_KEY = "College Maintenance_user";
const NOTIFICATION_KEY = "College Maintenance_notifications";

// Supabase connection. The publishable key is intended for browser use.
// Keep database access protected with correct Supabase RLS policies.
const SUPABASE_URL = "https://bbbpktisxnithvznrvwf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_j1d1TNMAB8BwEQrPVcdx8A_ftajJ8Dn";

if (!window.supabase) {
    console.error("Supabase JS library is missing. Add the Supabase CDN script before script.js.");
}

const supabaseClient = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    : null;

/* =========================================================
   STORAGE
========================================================= */

function getRequests() {
    try {
        const data = localStorage.getItem(REQUEST_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error("Unable to read requests:", error);
        return [];
    }
}

function saveRequests(requests) {
    localStorage.setItem(
        REQUEST_KEY,
        JSON.stringify(requests)
    );
}

function getCurrentUser() {
    return localStorage.getItem(USER_KEY);
}

/* =========================================================
   HELPERS
========================================================= */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(value) {

    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function statusClass(status) {

    if (status === "In Progress") {
        return "status-progress";
    }

    if (status === "Completed") {
        return "status-completed";
    }

    return "status-pending";
}

function generateRequestId() {

    const requests = getRequests();

    let max = 0;

    requests.forEach(request => {

        const number = parseInt(
            String(request.id || "")
                .replace(/^MR/i, ""),
            10
        );

        if (!isNaN(number) && number > max) {
            max = number;
        }
    });

    return "MR" +
        String(max + 1).padStart(3, "0");
}

/* =========================================================
   LOGIN
========================================================= */

function selectLoginType(type) {
    const loginType = document.getElementById("loginType");
    if (loginType) loginType.value = type;

    document.querySelectorAll(".login-tab").forEach(button => {
        button.classList.remove("active");
    });

    const buttons = document.querySelectorAll(".login-tab");
    if (type === "student" && buttons[0]) buttons[0].classList.add("active");
    if (type === "admin" && buttons[1]) buttons[1].classList.add("active");

    const error = document.getElementById("loginError");
    if (error) error.textContent = "";

    const id = document.getElementById("loginId");
    const password = document.getElementById("loginPassword");
    if (id) id.value = "";
    if (password) password.value = "";
}

// Single Supabase login handler: Student and Staff share the same login tab/dashboard.
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const type = document.getElementById("loginType")?.value || "student";
        const email = document.getElementById("loginId")?.value.trim() || "";
        const password = document.getElementById("loginPassword")?.value || "";
        const error = document.getElementById("loginError");

        if (error) error.textContent = "Signing in...";

        try {
            if (!supabaseClient) {
                throw new Error("Supabase did not load. Check the Supabase script in index.html.");
            }

            const { data, error: signInError } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            if (signInError) throw signInError;

            const { data: profile, error: profileError } = await supabaseClient
                .from("profiles")
                .select("role")
                .eq("id", data.user.id)
                .single();

            if (profileError || !profile) {
                await supabaseClient.auth.signOut();
                throw new Error("User role not found. Please contact the administrator.");
            }

            // The Student/Staff tab accepts either role; Admin tab accepts only admin.
            if (type === "admin" && profile.role !== "admin") {
                await supabaseClient.auth.signOut();
                throw new Error("This account does not have admin access.");
            }

            if (type === "student" && !["student", "staff"].includes(profile.role)) {
                await supabaseClient.auth.signOut();
                throw new Error("Please use the correct login tab for your account.");
            }

            localStorage.setItem(USER_KEY, profile.role);
            localStorage.setItem("College Maintenance_user_id", data.user.id);
            localStorage.setItem("College Maintenance_user_email", data.user.email || "");

            if (profile.role === "admin") {
                window.location.href = "admin-dashboard.html";
            } else if (profile.role === "student" || profile.role === "staff") {
                window.location.href = "student-dashboard.html";
            } else {
                await supabaseClient.auth.signOut();
                localStorage.removeItem(USER_KEY);
                throw new Error("Your account does not have an allowed role.");
            }
        } catch (err) {
            if (error) error.textContent = err.message || "Login failed. Please try again.";
        }
    });
}

/* =========================================================
   PAGE ACCESS
========================================================= */

(function checkAccess() {

    const page =
        location.pathname
            .split("/")
            .pop()
            .toLowerCase();

    if (
        !page ||
        page === "index.html"
    ) {
        return;
    }

    const user =
        getCurrentUser();

    const studentPages = [
        "student-dashboard.html",
        "report.html",
        "requests.html",
        "maintenance-guidelines.html",
        "help-support.html",
        "recent-requests.html"
    ];

    const adminPages = [
        "admin-dashboard.html",
        "admin-users.html",
        "admin-evidence.html",
        "admin-tracking.html"
    ];

    if (
        studentPages.includes(page) &&
        user !== "student" &&
        user !== "staff"
    ) {

        window.location.replace("index.html");

        return;
    }

    if (
        adminPages.includes(page) &&
        user !== "admin"
    ) {

        window.location.replace("index.html");
    }

})();

/* =========================================================
   LOGOUT
========================================================= */

function logout() {

    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("College Maintenance_user_id");
    localStorage.removeItem("College Maintenance_user_email");

    if (supabaseClient) {
        supabaseClient.auth.signOut().catch(console.error);
    }

    window.location.replace("index.html");
}

/* =========================================================
   PHOTO PREVIEW
========================================================= */

let selectedPhotoData = "";

const photoInput =
    document.getElementById("photo");

if (photoInput) {

    photoInput.addEventListener(
        "change",
        function() {

            const file =
                this.files[0];

            const preview =
                document.getElementById(
                    "photoPreview"
                );

            selectedPhotoData = "";

            if (!file) {

                if (preview) {
                    preview.innerHTML = "";
                }

                return;
            }

            if (!file.type.startsWith("image/")) {

                if (preview) {
                    preview.innerHTML =
                        "<p>Please select an image file.</p>";
                }

                return;
            }

            const reader =
                new FileReader();

            reader.onload =
                function(event) {

                    selectedPhotoData =
                        event.target.result;

                    if (preview) {

                        preview.innerHTML = `
                            <img
                                src="${selectedPhotoData}"
                                alt="Selected evidence"
                            >
                        `;
                    }
                };

            reader.readAsDataURL(file);
        }
    );
}

/* =========================================================
   SUBMIT REQUEST
========================================================= */

const requestForm =
    document.getElementById(
        "requestForm"
    );

if (requestForm) {

    requestForm.addEventListener(
        "submit",
        function(event) {

            event.preventDefault();

            const title =
                document
                    .getElementById("title")
                    ?.value.trim() || "";

            const location =
                document
                    .getElementById("location")
                    ?.value.trim() || "";

            const category =
                document
                    .getElementById("category")
                    ?.value || "";

            const description =
                document
                    .getElementById("description")
                    ?.value.trim() || "";

            const priority =
                document
                    .getElementById("priority")
                    ?.value || "Medium";

            const message =
                document.getElementById(
                    "formMessage"
                );

            if (
                !title ||
                !location ||
                !category ||
                !description
            ) {

                if (message) {

                    message.style.color =
                        "#e94b4b";

                    message.textContent =
                        "Please fill all required fields.";
                }

                return;
            }

            const now =
                new Date().toISOString();

            const request = {

                id: generateRequestId(),

                user: localStorage.getItem("College Maintenance_user_email") || getCurrentUser() || "Student",

                issue: title,

                title: title,

                room: location,

                location: location,

                category: category,

                priority: priority,

                description: description,

                evidence:
                    selectedPhotoData || "",

                photo:
                    selectedPhotoData || "",

                status: "Pending",

                createdAt: now,

                updatedAt: now
            };

            const requests =
                getRequests();

            requests.push(request);

            saveRequests(requests);

            addNotification(
                "New maintenance request submitted.",
                request.id
            );

            if (message) {

                message.style.color =
                    "#18a866";

                message.textContent =
                    `Request ${request.id} submitted successfully.`;
            }

            setTimeout(
                function() {

                    window.location.href =
                        "student-dashboard.html";

                },
                800
            );
        }
    );
}

/* =========================================================
   STUDENT DASHBOARD STATISTICS
========================================================= */

function updateStudentStats() {

    const requests =
        getRequests();

    const total =
        document.getElementById(
            "studentTotal"
        );

    const pending =
        document.getElementById(
            "studentPending"
        );

    const progress =
        document.getElementById(
            "studentProgress"
        );

    const completed =
        document.getElementById(
            "studentCompleted"
        );

    if (total) {
        total.textContent =
            requests.length;
    }

    if (pending) {
        pending.textContent =
            requests.filter(
                request =>
                    request.status === "Pending"
            ).length;
    }

    if (progress) {
        progress.textContent =
            requests.filter(
                request =>
                    request.status === "In Progress"
            ).length;
    }

    if (completed) {
        completed.textContent =
            requests.filter(
                request =>
                    request.status === "Completed"
            ).length;
    }
}

/* =========================================================
   RECENT REQUESTS
========================================================= */

function renderRecentRequests() {

    const list =
        document.getElementById(
            "recentRequests"
        );

    if (!list) {
        return;
    }

    let requests =
        getRequests();

    requests.sort(
        (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
    );

    requests =
        requests.slice(0, 5);

    if (!requests.length) {

        list.innerHTML = `
            <div class="empty-state">
                No maintenance requests submitted yet.
            </div>
        `;

        return;
    }

    list.innerHTML =
        requests.map(
            request => `

            <div class="request-item">

                <div class="request-item-top">

                    <div>

                        <h3>
                            ${escapeHTML(
                                request.id
                            )}
                            -
                            ${escapeHTML(
                                request.issue ||
                                request.title ||
                                "-"
                            )}
                        </h3>

                        <p>
                            <strong>Location:</strong>
                            ${escapeHTML(
                                request.room ||
                                request.location ||
                                "-"
                            )}
                            &nbsp;&nbsp;

                            <strong>Category:</strong>
                            ${escapeHTML(
                                request.category ||
                                "-"
                            )}
                        </p>

                    </div>

                    <span
                        class="status-pill
                        ${statusClass(
                            request.status
                        )}"
                    >
                        ${escapeHTML(
                            request.status
                        )}
                    </span>

                </div>

                <p>
                    Submitted:
                    ${formatDate(
                        request.createdAt
                    )}
                </p>

            </div>

        `
        ).join("");
}

/* =========================================================
   MY REQUESTS
========================================================= */

function renderMyRequests() {

    const list =
        document.getElementById(
            "myRequestsList"
        );

    if (!list) {
        return;
    }

    let requests =
        getRequests();

    const search =
        (
            document
                .getElementById(
                    "requestSearch"
                )
                ?.value || ""
        ).toLowerCase();

    const filter =
        document
            .getElementById(
                "requestFilter"
            )
            ?.value || "All";

    if (filter !== "All") {

        requests =
            requests.filter(
                request =>
                    request.status === filter
            );
    }

    if (search) {

        requests =
            requests.filter(
                request => {

                    return [
                        request.id,
                        request.issue,
                        request.room,
                        request.category
                    ].some(
                        value =>
                            String(
                                value || ""
                            )
                                .toLowerCase()
                                .includes(search)
                    );
                }
            );
    }

    requests.sort(
        (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
    );

    if (!requests.length) {

        list.innerHTML = `
            <div class="empty-state">
                No maintenance requests found.
            </div>
        `;

        return;
    }

    list.innerHTML =
        requests.map(
            request => `

            <div class="request-item">

                <div class="request-item-top">

                    <div>

                        <h3>
                            ${escapeHTML(
                                request.id
                            )}
                            -
                            ${escapeHTML(
                                request.issue ||
                                request.title ||
                                "-"
                            )}
                        </h3>

                        <p>
                            <strong>Location:</strong>
                            ${escapeHTML(
                                request.room ||
                                request.location ||
                                "-"
                            )}
                        </p>

                        <p>
                            <strong>Category:</strong>
                            ${escapeHTML(
                                request.category ||
                                "-"
                            )}

                            &nbsp;&nbsp;

                            <strong>Priority:</strong>
                            ${escapeHTML(
                                request.priority ||
                                "Medium"
                            )}
                        </p>

                    </div>

                    <span
                        class="status-pill
                        ${statusClass(
                            request.status
                        )}"
                    >
                        ${escapeHTML(
                            request.status
                        )}
                    </span>

                </div>

                <p>
                    ${escapeHTML(
                        request.description ||
                        ""
                    )}
                </p>

                <p>
                    <strong>
                        Last Updated:
                    </strong>
                    ${formatDate(
                        request.updatedAt
                    )}
                </p>

                ${
                    request.photo ||
                    request.evidence

                    ? `

                        <a
                            href="${
                                request.photo ||
                                request.evidence
                            }"
                            target="_blank"
                        >

                            <img
                                class="request-photo"
                                src="${
                                    request.photo ||
                                    request.evidence
                                }"
                                alt="Request evidence"
                            >

                        </a>

                    `

                    : ""
                }

            </div>

        `
        ).join("");
}

/* =========================================================
   STUDENT TRACKING
========================================================= */

function trackStudentRequest() {

    const input =
        document.getElementById(
            "trackId"
        );

    const result =
        document.getElementById(
            "trackResult"
        );

    if (!input || !result) {
        return;
    }

    const id =
        input.value.trim().toUpperCase();

    if (!id) {

        result.innerHTML = `
            <div class="result-card">
                <p>
                    Please enter a Request ID.
                </p>
            </div>
        `;

        return;
    }

    const request =
        getRequests().find(
            item =>
                String(item.id)
                    .toUpperCase() === id
        );

    if (!request) {

        result.innerHTML = `
            <div class="result-card">
                <p>
                    Request not found.
                    Please check the Request ID.
                </p>
            </div>
        `;

        return;
    }

    result.innerHTML = `

        <div class="result-card">

            <div class="result-top">

                <div>

                    <h3>
                        ${escapeHTML(
                            request.issue ||
                            request.title ||
                            "-"
                        )}
                    </h3>

                    <p>
                        <strong>
                            Request ID:
                        </strong>
                        ${escapeHTML(
                            request.id
                        )}
                    </p>

                </div>

                <span
                    class="status-pill
                    ${statusClass(
                        request.status
                    )}"
                >
                    ${escapeHTML(
                        request.status
                    )}
                </span>

            </div>

            <p>
                <strong>
                    Location:
                </strong>
                ${escapeHTML(
                    request.room ||
                    request.location ||
                    "-"
                )}
            </p>

            <p>
                <strong>
                    Category:
                </strong>
                ${escapeHTML(
                    request.category ||
                    "-"
                )}
            </p>

            <p>
                <strong>
                    Priority:
                </strong>
                ${escapeHTML(
                    request.priority ||
                    "Medium"
                )}
            </p>

            <p>
                <strong>
                    Last Updated:
                </strong>
                ${formatDate(
                    request.updatedAt
                )}
            </p>

            ${createTimeline(
                request
            )}

        </div>
    `;
}

/* =========================================================
   TIMELINE
========================================================= */

function createTimeline(request) {

    const statuses = [
        "Pending",
        "In Progress",
        "Completed"
    ];

    const currentIndex =
        statuses.indexOf(
            request.status
        );

    return `
        <div class="timeline">

            ${statuses.map(
                (status, index) => {

                    let className = "";

                    if (index < currentIndex) {
                        className = "done";
                    }

                    if (index === currentIndex) {
                        className =
                            currentIndex === 2
                                ? "done"
                                : "current";
                    }

                    return `

                        <div
                            class="timeline-step
                            ${className}"
                        >

                            <div
                                class="timeline-dot"
                            ></div>

                            <h4>
                                ${
                                    status === "Pending"
                                        ? "Request Submitted"
                                        : status === "In Progress"
                                        ? "Maintenance In Progress"
                                        : "Request Completed"
                                }
                            </h4>

                            <p>
                                ${
                                    status === request.status
                                        ? "Current status"
                                        : index < currentIndex
                                        ? "Completed"
                                        : "Waiting"
                                }
                            </p>

                        </div>

                    `;
                }
            ).join("")}

        </div>
    `;
}

/* =========================================================
   ADMIN STATISTICS
========================================================= */

function updateAdminStats() {

    const requests =
        getRequests();

    const total =
        document.getElementById(
            "adminTotal"
        );

    const pending =
        document.getElementById(
            "adminPending"
        );

    const progress =
        document.getElementById(
            "adminProgress"
        );

    const completed =
        document.getElementById(
            "adminCompleted"
        );

    if (total) {
        total.textContent =
            requests.length;
    }

    if (pending) {
        pending.textContent =
            requests.filter(
                request =>
                    request.status === "Pending"
            ).length;
    }

    if (progress) {
        progress.textContent =
            requests.filter(
                request =>
                    request.status === "In Progress"
            ).length;
    }

    if (completed) {
        completed.textContent =
            requests.filter(
                request =>
                    request.status === "Completed"
            ).length;
    }
}

/* =========================================================
   ADMIN REQUEST TABLE
========================================================= */

function renderAdminRequests() {

    const table =
        document.getElementById(
            "adminRequestTable"
        );

    if (!table) {
        return;
    }

    const requests =
        getRequests();

    if (!requests.length) {

        table.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    style="
                        text-align:center;
                        padding:30px;
                    "
                >
                    No maintenance requests
                    submitted yet.
                </td>
            </tr>
        `;

        return;
    }

    requests.sort(
        (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
    );

    table.innerHTML =
        requests.map(
            request => {

                const evidence =
                    request.photo ||
                    request.evidence ||
                    "";

                return `

                    <tr>

                        <td>
                            <strong>
                                ${escapeHTML(
                                    request.id
                                )}
                            </strong>
                        </td>

                        <td>
                            ${escapeHTML(
                                request.user ||
                                "Student"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                request.issue ||
                                request.title ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                request.room ||
                                request.location ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                request.category ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${
                                evidence
                                ?
                                `
                                <button
                                    type="button"
                                    class="evidence-btn"
                                    onclick="viewEvidence('${request.id}')"
                                >
                                    View Photo
                                </button>
                                `
                                :
                                `
                                <span>No photo</span>
                                `
                            }
                        </td>

                        <td>

                            <select
                                class="status-select"
                                data-id="${escapeHTML(
                                    request.id
                                )}"
                                onchange="
                                    updateRequestStatus(
                                        this.dataset.id,
                                        this.value
                                    )
                                "
                            >

                                <option
                                    value="Pending"
                                    ${
                                        request.status ===
                                        "Pending"
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    Pending
                                </option>

                                <option
                                    value="In Progress"
                                    ${
                                        request.status ===
                                        "In Progress"
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    In Progress
                                </option>

                                <option
                                    value="Completed"
                                    ${
                                        request.status ===
                                        "Completed"
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    Completed
                                </option>

                            </select>

                        </td>

                        <td>
                            ${formatDate(
                                request.updatedAt
                            )}
                        </td>

                    </tr>
                `;
            }
        ).join("");
}

/* =========================================================
   VIEW EVIDENCE PHOTO
========================================================= */

function viewEvidence(requestId) {

    const request = getRequests().find(
        item => String(item.id) === String(requestId)
    );

    if (!request) {
        alert("Request not found.");
        return;
    }

    const image =
        request.photo ||
        request.evidence ||
        "";

    if (!image) {
        alert("No evidence photo available.");
        return;
    }

    let modal =
        document.getElementById("evidencePhotoModal");

    if (!modal) {

        modal = document.createElement("div");

        modal.id = "evidencePhotoModal";

        modal.innerHTML = `
            <div class="evidence-photo-box">

                <button
                    type="button"
                    class="evidence-close"
                    onclick="closeEvidence()"
                >
                    ×
                </button>

                <img
                    id="evidencePhotoImage"
                    src=""
                    alt="Maintenance Evidence"
                >

            </div>
        `;

        document.body.appendChild(modal);
    }

    document.getElementById(
        "evidencePhotoImage"
    ).src = image;

    modal.style.display = "flex";
}

function closeEvidence() {

    const modal =
        document.getElementById(
            "evidencePhotoModal"
        );

    if (modal) {
        modal.style.display = "none";
    }
}

/* =========================================================
   UPDATE STATUS
========================================================= */

function updateRequestStatus(
    requestId,
    newStatus
) {

    const requests =
        getRequests();

    const request =
        requests.find(
            item =>
                String(item.id) ===
                String(requestId)
        );

    if (!request) {
        return;
    }

    const oldStatus =
        request.status;

    request.status =
        newStatus;

    request.updatedAt =
        new Date().toISOString();

    saveRequests(requests);

    if (oldStatus !== newStatus) {

        addNotification(
            `${request.id} status changed to ${newStatus}.`,
            request.id
        );
    }

    renderAdminRequests();

    updateAdminStats();

    updateStudentStats();

    renderRecentRequests();

    renderMyRequests();
}

/* =========================================================
   EVIDENCE
   Supports BOTH old and new element IDs.
========================================================= */

function renderAdminEvidence() {

    const list =
        document.getElementById(
            "evidencePageList"
        ) ||
        document.getElementById(
            "adminEvidenceList"
        );

    if (!list) {
        return;
    }

    const requests =
        getRequests().filter(
            request =>
                request.photo ||
                request.evidence
        );

    if (!requests.length) {

        list.innerHTML = `
            <div class="empty-state">
                No request evidence available.
            </div>
        `;

        return;
    }

    list.className =
        "evidence-grid";

    list.innerHTML =
        requests.map(
            request => {

                const image =
                    request.photo ||
                    request.evidence;

                return `

                    <div
                        class="evidence-card"
                    >

                        <img
                            src="${image}"
                            alt="Maintenance evidence"
                        >

                        <h3>
                            ${escapeHTML(
                                request.id
                            )}
                            -
                            ${escapeHTML(
                                request.issue ||
                                request.title ||
                                "-"
                            )}
                        </h3>

                        <p>
                            <strong>
                                Location:
                            </strong>
                            ${escapeHTML(
                                request.room ||
                                request.location ||
                                "-"
                            )}
                        </p>

                        <p>
                            <strong>
                                Category:
                            </strong>
                            ${escapeHTML(
                                request.category ||
                                "-"
                            )}
                        </p>

                        <p>
                            <strong>
                                Status:
                            </strong>
                            ${escapeHTML(
                                request.status
                            )}
                        </p>

                        <button
                            type="button"
                            class="evidence-btn"
                            onclick="viewEvidence('${request.id}')"
                        >
                            Open Full Photo
                        </button>

                    </div>

                `;
            }
        ).join("");
}

/* =========================================================
   ADMIN USER MANAGEMENT
========================================================= */

function renderAdminUsers() {

    const list =
        document.getElementById(
            "usersList"
        );

    if (!list) {
        return;
    }

    const requests =
        getRequests();

    if (!requests.length) {

        list.innerHTML = `
            <div class="empty-state">
                No users have submitted requests.
            </div>
        `;

        return;
    }

    const users = [
        ...new Set(
            requests.map(
                request =>
                    request.user ||
                    "Student"
            )
        )
    ];

    list.innerHTML =
        users.map(
            user => `

                <div class="request-item">

                    <h3>
                        👤
                        ${escapeHTML(
                            user
                        )}
                    </h3>

                    <p>
                        Requests submitted:
                        ${
                            requests.filter(
                                request =>
                                    (
                                        request.user ||
                                        "Student"
                                    ) === user
                            ).length
                        }
                    </p>

                </div>
            `
        ).join("");
}

/* =========================================================
   ADMIN TRACKING
   Supports BOTH old IDs.
========================================================= */

function renderAdminTracking() {

    const list =
        document.getElementById(
            "trackingList"
        ) ||
        document.getElementById(
            "trackingPageList"
        );

    if (!list) {
        return;
    }

    const requests =
        getRequests();

    if (!requests.length) {

        list.innerHTML = `
            <div class="empty-state">
                No maintenance requests found.
            </div>
        `;

        return;
    }

    list.innerHTML =
        requests.map(
            request => `

                <div class="request-item">

                    <div class="request-item-top">

                        <div>

                            <h3>
                                ${escapeHTML(
                                    request.id
                                )}
                                -
                                ${escapeHTML(
                                    request.issue ||
                                    request.title ||
                                    "-"
                                )}
                            </h3>

                            <p>
                                <strong>
                                    Location:
                                </strong>
                                ${escapeHTML(
                                    request.room ||
                                    request.location ||
                                    "-"
                                )}
                            </p>

                        </div>

                        <span
                            class="status-pill
                            ${statusClass(
                                request.status
                            )}"
                        >
                            ${escapeHTML(
                                request.status
                            )}
                        </span>

                    </div>

                    ${createTimeline(
                        request
                    )}

                    <p>
                        <strong>
                            Last Updated:
                        </strong>
                        ${formatDate(
                            request.updatedAt
                        )}
                    </p>

                </div>

            `
        ).join("");
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

function getNotifications() {

    try {

        return JSON.parse(
            localStorage.getItem(
                NOTIFICATION_KEY
            )
        ) || [];

    } catch {

        return [];
    }
}

function saveNotifications(
    notifications
) {

    localStorage.setItem(
        NOTIFICATION_KEY,
        JSON.stringify(
            notifications
        )
    );
}

function addNotification(
    message,
    requestId
) {

    const notifications =
        getNotifications();

    notifications.unshift({

        message: message,

        requestId:
            requestId || "",

        date:
            new Date().toISOString()

    });

    saveNotifications(
        notifications.slice(0, 20)
    );
}

function renderNotifications() {

    const list =
        document.getElementById(
            "notificationList"
        );

    if (!list) {
        return;
    }

    const notifications =
        getNotifications();

    if (!notifications.length) {

        list.innerHTML = `
            <div class="empty-state">
                No notifications yet.
            </div>
        `;

        return;
    }

    list.innerHTML =
        notifications.map(
            item => `

                <div
                    class="notification"
                >

                    <div
                        class="notification-icon"
                    >
                        🔔
                    </div>

                    <div>

                        <strong>
                            ${escapeHTML(
                                item.message
                            )}
                        </strong>

                        <p>
                            ${formatDate(
                                item.date
                            )}
                        </p>

                    </div>

                </div>
            `
        ).join("");
}

/* =========================================================
   ROLE-BASED WELCOME MESSAGE
========================================================= */

function displayWelcomeMessage() {
    const user = getCurrentUser();
    const welcomeMessage = document.getElementById("welcomeMessage");

    if (!welcomeMessage) return;

    if (user === "staff") {
        welcomeMessage.textContent = "Welcome, Staff!";
    } else if (user === "student") {
        welcomeMessage.textContent = "Welcome, Student!";
    } else {
        welcomeMessage.textContent = "Welcome!";
    }
}

/* =========================================================
   INITIALIZE
========================================================= */

function initializePage() {
    displayWelcomeMessage();

    renderMyRequests();

    renderAdminRequests();

    renderAdminEvidence();

    renderAdminUsers();

    renderAdminTracking();

    renderNotifications();

    updateAdminStats();

    updateStudentStats();

    renderRecentRequests();
}

document.addEventListener(
    "DOMContentLoaded",
    initializePage
);

/* =========================================================
   AUTO REFRESH
========================================================= */

window.addEventListener(
    "focus",
    function() {

        renderMyRequests();

        renderAdminRequests();

        renderAdminEvidence();

        renderAdminUsers();

        renderAdminTracking();

        renderNotifications();

        updateAdminStats();

        updateStudentStats();

        renderRecentRequests();
    }
);