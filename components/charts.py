import plotly.express as px
import streamlit as st

PALETTE = ['#164E87', '#16805D', '#B37500', '#C33B40', '#6C7D90', '#64A7D8']


def chart(frame, kind, x=None, y=None, title='', color=None, key=None, **kwargs):
    if frame.empty:
        st.info(f'{title}: Not Available — no matching measurements.')
        return
    if kind == 'pie':
        figure = px.pie(frame, names=x, values=y, hole=.6, color=x,
            color_discrete_map={'Delivered': '#16805D', 'Pending': '#B37500', 'Unknown': '#6C7D90'})
    else:
        figure = getattr(px, kind)(frame, x=x, y=y, color=color,
            color_discrete_sequence=PALETTE, **kwargs)
    figure.update_layout(title=title, paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)', font={'color': '#142D49', 'family': 'Arial'},
        margin={'l': 10, 'r': 10, 't': 50, 'b': 20}, height=340,
        legend_title_text='', hoverlabel={'font_size': 13})
    st.plotly_chart(figure, width='stretch', key=key, config={'displaylogo': False})
