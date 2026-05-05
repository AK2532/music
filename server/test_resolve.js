import axios from 'axios';

async function testResolve() {
    try {
        const id = 'RDCLAK5uy_nhLiD_PquxQnzA35YpoaaAUv2ikZuYFgw';
        console.log(`Testing resolve for playlist: ${id}`);
        const res = await axios.get(`http://localhost:3000/api/resolve?kind=playlist&id=${id}`);
        console.log('Response Status:', res.status);
        console.log('Title:', res.data.title);
        console.log('Tracks count:', res.data.tracks?.length);
        if (res.data.tracks?.length > 0) {
             console.log('First track:', JSON.stringify(res.data.tracks[0], null, 2));
        }
    } catch (e) {
        console.error('Error:', e.response ? e.response.data : e.message);
    }
}

testResolve();
