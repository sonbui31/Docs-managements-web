import type { CommentThread, Project, ProjectDocument } from "./types";

export const projects: Project[] = [
  {
    id: "p-core",
    code: "CRM-24",
    name: "CRM Revamp",
    client: "Sales Ops & Enterprise",
    progress: 68,
    openComments: 5,
    documents: 12
  },
  {
    id: "p-mobile",
    code: "MOB-08",
    name: "Mobile Banking App",
    client: "Retail Digital Team",
    progress: 42,
    openComments: 8,
    documents: 18
  },
  {
    id: "p-erp",
    code: "ERP-11",
    name: "Procurement Workflow",
    client: "Finance & Accounting",
    progress: 86,
    openComments: 2,
    documents: 27
  }
];

export const documents: ProjectDocument[] = [
  // p-core documents
  {
    id: "d-brd",
    title: "Business Requirement Document - Core Architecture",
    type: "BRD",
    owner: "BA Lead (Minh Vance)",
    status: "In Review",
    version: "v0.8",
    updatedAt: "04 Aug 2026",
    projectId: "p-core",
    fileType: "docx",
    size: "2.4 MB",
    progress: 75,
    reqCount: 12,
    openCommentsCount: 3
  },
  {
    id: "d-srs",
    title: "System Requirement Specification - API & Auth Matrix",
    type: "SRS",
    owner: "Solution BA (Elena)",
    status: "Draft",
    version: "v0.4",
    updatedAt: "03 Aug 2026",
    projectId: "p-core",
    fileType: "md",
    size: "840 KB",
    progress: 35,
    reqCount: 8,
    openCommentsCount: 2
  },
  {
    id: "d-cr",
    title: "Change Request - Approval Matrix & Role Definitions",
    type: "CR",
    owner: "Product BA (Devon)",
    status: "Approved",
    version: "v1.0",
    updatedAt: "31 Jul 2026",
    projectId: "p-core",
    fileType: "pdf",
    size: "1.8 MB",
    progress: 100,
    reqCount: 5,
    openCommentsCount: 0
  },
  {
    id: "d-signoff",
    title: "Final Acceptance & Audit Evidence",
    type: "BRD",
    owner: "Compliance BA (David)",
    status: "Approved",
    version: "v2.0",
    updatedAt: "28 Jul 2026",
    projectId: "p-core",
    fileType: "pdf",
    size: "4.1 MB",
    progress: 100,
    reqCount: 6,
    openCommentsCount: 0
  },

  // p-mobile documents
  {
    id: "d-mob-1",
    title: "Mobile Banking Security & Biometric Auth Requirements",
    type: "SRS",
    owner: "Mobile BA Lead",
    status: "In Review",
    version: "v1.2",
    updatedAt: "02 Aug 2026",
    projectId: "p-mobile",
    fileType: "docx",
    size: "3.1 MB",
    progress: 50,
    reqCount: 14,
    openCommentsCount: 5
  },
  {
    id: "d-mob-2",
    title: "E-KYC Verification Workflow Specs",
    type: "BRD",
    owner: "Digital Risk BA",
    status: "Draft",
    version: "v0.3",
    updatedAt: "01 Aug 2026",
    projectId: "p-mobile",
    fileType: "pdf",
    size: "1.5 MB",
    progress: 25,
    reqCount: 9,
    openCommentsCount: 3
  },

  // p-erp documents
  {
    id: "d-erp-1",
    title: "PO Approval & Vendor Integration Specification",
    type: "BRD",
    owner: "ERP Lead BA",
    status: "Approved",
    version: "v2.1",
    updatedAt: "29 Jul 2026",
    projectId: "p-erp",
    fileType: "pdf",
    size: "5.2 MB",
    progress: 100,
    reqCount: 18,
    openCommentsCount: 1
  },
  {
    id: "d-erp-2",
    title: "Audit Logging & Financial Reconciliation Matrix",
    type: "CR",
    owner: "Finance Analyst",
    status: "Approved",
    version: "v1.0",
    updatedAt: "25 Jul 2026",
    projectId: "p-erp",
    fileType: "docx",
    size: "2.0 MB",
    progress: 100,
    reqCount: 10,
    openCommentsCount: 0
  }
];

export const initialComments: CommentThread[] = [
  {
    id: "c-1",
    blockId: "REQ-001",
    author: "Alex Morgan",
    authorRole: "Project Manager",
    text: "Can xac nhan rule OTP cho user ngoai gio hanh chinh khi truy cap portal CRM.",
    status: "open",
    createdAt: "10:24 AM, Today",
    documentId: "d-brd"
  },
  {
    id: "c-2",
    blockId: "REQ-002",
    author: "Tran Duc",
    authorRole: "Tech Lead",
    text: "Can kiem tra lai kha nang import file .docx dung luong > 10MB co gay giat lag UI khong.",
    status: "open",
    createdAt: "Yesterday",
    documentId: "d-brd"
  },
  {
    id: "c-3",
    blockId: "REQ-004",
    author: "Elena Rostova",
    authorRole: "Solution Architect",
    text: "Them API dependency cho module customer profile va caching layer Redis.",
    status: "open",
    createdAt: "02 Aug 2026",
    documentId: "d-brd"
  },
  {
    id: "c-4",
    blockId: "REQ-001",
    author: "Pham Hoa",
    authorRole: "Client Representative",
    text: "Dong y voi de xuat auth flow. Vui long cap nhat vao ban PDF cuoi.",
    status: "resolved",
    createdAt: "01 Aug 2026",
    documentId: "d-brd"
  },
  {
    id: "c-5",
    blockId: "REQ-001",
    author: "Security Team",
    authorRole: "Security Engineer",
    text: "Kiem tra lai SSL pin va FaceID token timeout trong app banking.",
    status: "open",
    createdAt: "02 Aug 2026",
    documentId: "d-mob-1"
  }
];
