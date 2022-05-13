import Axios from "axios";

const {
    METABASE_API_URL,
    METABASE_API_USER,
    METABASE_API_PASSWORD,
} = process.env;

const axios = Axios.create({
    baseURL: METABASE_API_URL,
});

type MetabaseDashboardResponse = {
    id: number;
    name: string;
    ordered_cards?: {
        card: {
            id: number;
            name: string;
        }
    }[];
};

export type GraphData = [string, number];
export type GraphResult = Array<GraphData>;

export type Card = {
    id: number;
    name: string;
};

export type Dashboard = {
    id: number;
    name: string;
    cards: Card[];
};

export namespace Metabase {

    let session: string | null = null;
    let authenticator: number | null = null;

    export async function connect(): Promise<void> {
        if (authenticator !== null)
            axios.interceptors.request.eject(authenticator);

        const { status, data } = await axios.post('/session', {
            username: METABASE_API_USER,
            password: METABASE_API_PASSWORD
        });

        if (status !== 200)
            throw new Error('Failed to initiate Metabase API');

        session = data['id'];
        authenticator = axios.interceptors.request.use((config) => {
            if (config.headers && session)
                config.headers['X-Metabase-Session'] = session;

            return config;
        });

        console.log('Connected to the Metabase API');
    }

    export async function fetchCard(id: string): Promise<GraphResult> {
        const { status, data } = await axios.post(`/card/${id}/query`);

        if (status !== 202)
            throw new Error(`Failed to fetch data from card id '${id}'`);

        return data.data.rows;
    }

    export async function getDashboards(): Promise<Dashboard[]> {
        const { status, data } = await axios.get<MetabaseDashboardResponse[]>('/dashboard');

        if (status !== 200)
            throw new Error('Failed to fetch dashboards');

        return Promise.all(
            data.map(({ id }) => Metabase.getDashboard(String(id)))
        );
    }

    export async function getDashboard(id: string): Promise<Dashboard> {
        const { status, data } = await axios.get<MetabaseDashboardResponse>(`/dashboard/${id}`);

        if (status !== 200)
            throw new Error(`Failed to fetch dashboard id '${id}'`);

        const cards: Card[] = data.ordered_cards?.map(e => e['card'])
            .map(({ id, name }) => ({ id, name })) || [];

        return {
            id: data['id'],
            name: data['name'],
            cards,
        };
    }
}
