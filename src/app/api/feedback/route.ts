import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const email = user?.email || "anonymous@orkestrate.space";
    const name = user?.user_metadata?.full_name || user?.user_metadata?.user_name || "Anonymous User";

    const formData = await req.formData();
    const message = formData.get("message") as string;
    const images = formData.getAll("images") as File[];

    if (!message && (!images || images.length === 0)) {
      return NextResponse.json({ error: "No message or images provided" }, { status: 400 });
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error("Missing Gmail credentials in environment variables.");
      return NextResponse.json(
        { error: "Internal server error: missing email credentials." },
        { status: 500 }
      );
    }

    // Set up Nodemailer transport using Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const attachments = [];
    for (const image of images) {
      if (image instanceof File) {
        const buffer = Buffer.from(await image.arrayBuffer());
        attachments.push({
          filename: image.name,
          content: buffer,
          contentType: image.type,
        });
      }
    }


    const mailOptions = {
      from: `"Orkestrate" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      replyTo: email, // ← sender's email, so you can hit reply
      subject: "📣 New Orkestrate Feedback",
      text: `From: ${name} <${email}>\n\n${message}`,
      attachments,
    };
    // Send email
    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to send feedback email via Nodemailer:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
