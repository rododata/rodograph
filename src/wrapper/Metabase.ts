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

const ACCIDENTS_TABLE = 5;
const RODODATA_DATABASE = 2;

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

type MetabaseQueryMetadataField = {
    id: number;
    effective_type: string;
    display_name: string;
    dimension_options: string[];
};

type MetabaseQueryMetadataResponse = {
    fields: MetabaseQueryMetadataField[];
    dimension_options: []; // TODO
};

type MetabaseDatasetQueryReponse = {
    data: {
        cols: {
            description?: string | null;
            display_name: string;
        }[];
        rows: unknown[][];
    };
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

type Query<T extends PossibleFilters> = {
    type: T;
    fieldId: number;
};

export type FilterByQuery = Query<'filterBy'> & {
    operator?: '>' | '<' | '=';
    value?: unknown;
}

export type GroupByQuery = Query<'groupBy'>;

type QueryType = FilterByQuery | GroupByQuery;

export type FilterableField = {
    type: PossibleFilters;
    fieldId: number;
    name: string;
};

export type QueryField = {
    id: number;
    name: string;
    type: string;
    dimensions: string[];
};

export type QueryOptions = {
    fields: QueryField[];
    // dimensions: []; // TODO
};

export type QueryResult = {
    data: unknown[][];
    labels: string[];
};

type CardFilterableFields = {
    cardId: number;
    fields: FilterableField[];
};

const isFilterByQuery = (query: QueryType): query is FilterByQuery =>
    query.type === 'filterBy';

const isGroupByQuery = (query: QueryType): query is GroupByQuery =>
    query.type === 'groupBy';

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

const mapQueryField = (field: MetabaseQueryMetadataField): QueryField => ({
    id: field.id,
    name: field.display_name,
    type: field.effective_type,
    dimensions: field.dimension_options,
});

const createQueryMBQL = (queries: QueryType[] = []) => {
    const aggregation = [];
    const breakout = [];
    const filter = [];

    for (const query of queries) {
        const field = ["field", query.fieldId, null];

        if (isFilterByQuery(query)) {
            filter.push(query.operator || '=', field, query.value || '');
            continue;
        }

        if (isGroupByQuery(query)) {
            if (!aggregation.flat().includes('count'))
                aggregation.push(['count']);

            breakout.push(field);
            continue;
        }
    }

    return { aggregation, breakout, filter };
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

    export async function filterCard(id: string, filters: QueryType[] = []): Promise<GraphResult> {
        let { status, data } = await axios.get(`/card/${id}`);

        if (status !== 200)
            throw new Error(`Failed to get card id '${id}'`);

        const datasetQuery = data['dataset_query'];
        const query = Object.assign(createQueryMBQL(filters), datasetQuery['query']);

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

    export async function getQueryOptions(): Promise<QueryOptions> {
        const { data, status } = await axios.get<MetabaseQueryMetadataResponse>(`/table/${ACCIDENTS_TABLE}/query_metadata`);

        if (status !== 200)
            throw new Error('Failed to fetch query options');

        const fields = data.fields.map(mapQueryField);

        return { fields };
    }

    export async function query(filters: QueryType[] = []): Promise<QueryResult> {
        const options = {
            database: RODODATA_DATABASE,
            query: {
                'source-table': ACCIDENTS_TABLE,
            },
            type: 'query',
        };

        Object.assign(options.query, createQueryMBQL(filters));
        const { data, status } = await axios.post<MetabaseDatasetQueryReponse>('/dataset', options);

        if (status !== 202)
            throw new Error('Failed to query data');

        const { cols, rows } = data['data'];
        const labels = cols.map(e => e.display_name);

        return { data: rows, labels };
    }
}
