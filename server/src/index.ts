import { Hono } from 'hono'
import { cors } from 'hono/cors'
import health from './routes/health'
import auth from './routes/auth'
import usersRouter from './routes/users'
import messagesRouter from './routes/messages'
import notificationsRouter from './routes/notifications'

const app = new Hono()

app.use('*', cors({
    origin: (origin) => origin ?? '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
}))

app.route('/health', health)
app.route('/auth', auth)
app.route('/users', usersRouter)
app.route('/messages', messagesRouter)
app.route('/notifications', notificationsRouter)

export default {
    port: parseInt(process.env.PORT ?? '8551'),
    fetch: app.fetch,
}
