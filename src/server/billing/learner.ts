import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, students } from "@/db/schema";
import { invoiceDetail } from "./detail";
import { creditBalance } from "./invoices";
import { listInvoiceRows } from "./reports";

const studentOf = async (userId: string) => {
  const [row] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.userId, userId));
  return row?.id ?? null;
};

/** A learner's issued bills across all their teachers. */
export async function learnerBills(userId: string, now = new Date()) {
  const studentId = await studentOf(userId);
  if (!studentId) return { due: 0, bills: [], credit: 0 };
  const teachers = await db
    .selectDistinct({ teacherId: invoices.teacherId })
    .from(invoices)
    .where(eq(invoices.studentId, studentId));
  const rows = (
    await Promise.all(teachers.map((t) => listInvoiceRows(t.teacherId, now, { studentId })))
  )
    .flat()
    .filter((r) => r.status === "issued")
    .sort((a, b) => (b.issuedAt?.getTime() ?? 0) - (a.issuedAt?.getTime() ?? 0));
  return {
    due: rows.reduce((n, r) => n + r.left, 0),
    bills: rows,
    credit: await creditBalance(db, studentId),
  };
}

export async function learnerBill(userId: string, invoiceId: string, now = new Date()) {
  const studentId = await studentOf(userId);
  return studentId ? invoiceDetail(invoiceId, { studentId }, now) : null;
}

export { studentOf };
