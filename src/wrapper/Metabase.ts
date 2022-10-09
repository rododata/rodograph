import Axios from "axios";
import { getFirestore } from "firebase-admin/firestore";

const {
    METABASE_API_URL,
    METABASE_API_USER,
    METABASE_API_PASSWORD,
} = process.env;

const axios = Axios.create({
    baseURL: METABASE_API_URL,
    validateStatus: () => true,
});

type MetabaseResultMetadata = {
    id?: number;
    display_name: string;
    field_ref: [string, number];
};

type MetabaseOrderedCardResponse = {
    card: {
        id: number;
        name: string;
        display: string;
        result_metadata: MetabaseResultMetadata[];
    }
};

type MetabaseDashboardResponse = {
    id: number;
    name: string;
    ordered_cards?: MetabaseOrderedCardResponse[];
};

export type GraphData = [string, number];
export type GraphResult = Array<GraphData>;

export type Dataset = {
    label: string;
};

const chartTypes = ['bar', 'line', 'scatter', 'bubble', 'pie', 'doughnut', 'polarArea', 'radar'] as const;
export type ChartType = typeof chartTypes[number];

export type Card = {
    id: number;
    name: string;
    type?: ChartType;
    datasets: Dataset[];
    filters: FilterableField[];
};

export type Dashboard = {
    id: number;
    name: string;
    cards: Card[];
};

type PossibleFilters = 'filterBy' | 'groupBy';

export type FilterQuery = {
    type: PossibleFilters;
    fieldId: number;
    value?: unknown;
};

export type FilterableField = {
    type: PossibleFilters;
    fieldId: number;
    name: string;
};

type CardFilterableFields = {
    cardId: number;
    fields: FilterableField[];
};

const metabaseDisplayToChartType = (display: MetabaseOrderedCardResponse['card']['display']): ChartType | undefined => {
    const _chartType = display as ChartType;

    if (chartTypes.includes(_chartType))
        return _chartType;

    return undefined;
};

const metabaseCardToCard = (card: MetabaseOrderedCardResponse['card'], filter?: CardFilterableFields | null): Card => {
    const { id, name, display } = card;
    const type = metabaseDisplayToChartType(display);
    const datasets = card.result_metadata
        .filter(e => e.field_ref[0] === 'field')
        .map(({ display_name }) => ({ label: display_name }));

    let filters: Card['filters'] = [];

    if (filter)
        filters = filter.fields;

    return { id, name, type, datasets, filters };
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

    export async function filterCard(id: string, filters: FilterQuery[] = []): Promise<GraphResult> {
        let { status, data } = await axios.get(`/card/${id}`);

        if (status !== 200)
            throw new Error(`Failed to get card id '${id}'`);

        const datasetQuery = data['dataset_query'];
        const query = Object.assign({
            aggregation: [],
            breakout: [],
            filter: [],
        }, datasetQuery['query']);

        filters.forEach(({ type, fieldId, value }) => {
            const _field = ["field", fieldId, null];

            if (type === 'filterBy') {
                query['filter'].push('=', _field, value);
            }

            if (type === 'groupBy') {
                query['breakout'].push(_field);
            }
        });

        Object.assign(datasetQuery, { query });
        ({ status, data } = await axios.post('/dataset', datasetQuery));

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

        let cards: Card[] = [];

        if (data.ordered_cards) {
            const Firestore = getFirestore();
            const cardIds = data.ordered_cards.map(({ card }) => card.id);

            const filters = await Firestore.collection('filters')
                .where('cardId', 'in', cardIds).get();
            const fields = filters.docs.map(e =>
                e.data() as CardFilterableFields
            );

            cards = data.ordered_cards.map(({ card }) => card).map(
                card => metabaseCardToCard(card, fields.find(e => e.cardId === card.id))
            );
        }

        return {
            id: data['id'],
            name: data['name'],
            cards,
        };
    }
}
