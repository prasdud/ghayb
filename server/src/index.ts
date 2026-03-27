import { Hono } from 'hono'
import health from './routes/health'
import auth from './routes/auth'

const app = new Hono()

app.route('/health', health)
app.route('/auth', auth)

export default {
    port: parseInt(process.env.PORT ?? '8551'),
    fetch: app.fetch,
}
