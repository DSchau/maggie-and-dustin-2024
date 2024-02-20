import { type APIRoute } from "astro";
import { Resend } from 'resend'

const resend = new Resend(import.meta.env.RESEND_API_KEY)

export const prerender = false;

const SPAM_FIELD_VALUE = import.meta.env.PUBLIC_SPAM_FIELD_VALUE

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData()
    const name = formData.get('name')
    const lastName = formData.get('lastName')
    const email = formData.get('email')
    const message = formData.get('message')

    if (lastName !== SPAM_FIELD_VALUE) {
      throw new Error('Likely spam')
    }
  
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({
          message: `Missing required field`
        }),
        {
          status: 400
        }
      )
    }
    const { error } = await resend.emails.send({
      from: `Website Contact Form <website@dschau.dev>`,
      to: ['website@dustinschau.com'],
      subject: `Hello from website | ${name}`,
      html: `
        <h2>Received an e-mail from dustinschau.com</h2>
        <h3>From: <a href="mailto:${email}">${name} (${email})</h3>
        <p>${message}</p>
      `
    })
  
    if (error) {
      throw error
    }
    return new Response(
      JSON.stringify({
        message: `I received your response. Thanks! Go ahead and navigate back now.`,
      }),
      {
        status: 200
      }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        message: e.message,
        stack: e.stack
      }),
      {
        status: 500
      }
    )
  }
}