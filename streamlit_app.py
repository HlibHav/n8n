#!/usr/bin/env python3
"""Fashion Creative Generator - Streamlit Frontend"""

import streamlit as st
import requests
import pandas as pd
import time
from datetime import datetime

# Configuration
LOCAL_SERVER_URL = "http://localhost:3000/api/generate-creative"

# Page config
st.set_page_config(
    page_title="Fashion Creative Generator",
    page_icon="🎨",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .main-header {
        text-align: center;
        color: #2E86AB;
        margin-bottom: 2rem;
    }
    .success-message {
        background-color: #d4edda;
        color: #155724;
        padding: 1rem;
        border-radius: 0.5rem;
        border: 1px solid #c3e6cb;
        margin: 1rem 0;
    }
    .error-message {
        background-color: #f8d7da;
        color: #721c24;
        padding: 1rem;
        border-radius: 0.5rem;
        border: 1px solid #f5c6cb;
        margin: 1rem 0;
    }
    .info-box {
        background-color: #d1ecf1;
        color: #0c5460;
        padding: 1rem;
        border-radius: 0.5rem;
        border: 1px solid #bee5eb;
        margin: 1rem 0;
    }
</style>
""", unsafe_allow_html=True)

def load_personas_from_excel():
    """Load personas from Excel file"""
    try:
        df = pd.read_excel('personas.xlsx')
        return df
    except Exception as e:
        st.error(f"Error loading personas: {str(e)}")
        return pd.DataFrame()


def call_local_server(data):
    """Call local server directly"""
    try:
        # Debug: Show what we're sending
        st.write("🔍 **DEBUG - Sending data to server:**")
        st.write(f"- Data keys: {list(data.keys())}")
        st.write(f"- Profile keys: {list(data.get('profile', {}).keys())}")
        st.write(f"- Product keys: {list(data.get('product', {}).keys())}")
        st.write(f"- Options keys: {list(data.get('options', {}).keys())}")
        
        response = requests.post(LOCAL_SERVER_URL, json=data, timeout=120)
        st.write(f"🔍 **DEBUG - Server Response Status:** {response.status_code}")
        st.write(f"🔍 **DEBUG - Server Response Headers:** {dict(response.headers)}")
        
        try:
            result = response.json()
            st.write(f"🔍 **DEBUG - Parsed JSON Response:** {result}")
        except Exception as e:
            st.write(f"🔍 **DEBUG - JSON Parse Error:** {str(e)}")
            st.write(f"🔍 **DEBUG - Raw Response Text:** {response.text}")
            result = {"error": f"JSON parse error: {str(e)}"}
        
        return result, response.status_code
    except requests.exceptions.RequestException as e:
        st.write(f"🔍 **DEBUG - Request error:** {str(e)}")
        return {"error": str(e)}, 500

def poll_for_image(request_id):
    """Poll for the final image from BFL API"""
    try:
        response = requests.get(
            f"http://localhost:3000/api/poll-image/{request_id}",
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": f"Polling failed: {response.status_code}"}
    except requests.exceptions.RequestException as e:
        return {"error": f"Polling error: {str(e)}"}

def main():
    st.markdown('<h1 class="main-header">🎨 Fashion Creative Generator</h1>', unsafe_allow_html=True)
    
    # Load personas data
    personas_df = load_personas_from_excel()
    
    # Sidebar
    with st.sidebar:
        st.header("📊 Data Overview")
        if not personas_df.empty:
            st.write(f"**Total Personas:** {len(personas_df)}")
            st.write(f"**Columns:** {len(personas_df.columns)}")
            
            # Show persona types
            if 'persona_label' in personas_df.columns:
                persona_counts = personas_df['persona_label'].value_counts()
                st.write("**Persona Distribution:**")
                st.write(persona_counts)
        else:
            st.warning("No personas data loaded")
        
        st.header("🎲 Random Actions")
        if st.button("🎲 Random Persona", type="secondary"):
            if not personas_df.empty:
                random_persona = personas_df.sample(1).iloc[0]
                st.session_state.sample_data = random_persona.to_dict()
                st.success(f"Selected: {random_persona.get('display_name', 'Unknown')}")
            else:
                st.error("No personas available")
        
        if st.button("🎨 Generate Random Creative", type="primary"):
            if not personas_df.empty:
                random_persona = personas_df.sample(1).iloc[0]
                st.session_state.sample_data = random_persona.to_dict()
                st.session_state.auto_generate = True
                st.success("Random creative generation triggered!")
            else:
                st.error("No personas available")
    
    # Main content
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.header("👤 User Profile")
        
        # Initialize session state
        if 'sample_data' not in st.session_state:
            st.session_state.sample_data = {}
        
        # Form fields
        with st.form("user_profile_form"):
            # Basic Info
            st.subheader("Basic Information")
            email = st.text_input(
                "Email *", 
                value=st.session_state.sample_data.get('email', ''),
                help="Required field"
            )
            display_name = st.text_input(
                "Display Name *", 
                value=st.session_state.sample_data.get('display_name', ''),
                help="Required field"
            )
            
            # Location
            col_country, col_city = st.columns(2)
            with col_country:
                country = st.text_input(
                    "Country",
                    value=st.session_state.sample_data.get('country', 'US')
                )
            with col_city:
                city = st.text_input(
                    "City",
                    value=st.session_state.sample_data.get('city', 'New York')
                )
            
            # Social Media Info
            st.subheader("Social Media Profile")
            col_followers, col_posts = st.columns(2)
            with col_followers:
                followers = st.number_input(
                    "Followers",
                    min_value=0,
                    value=int(st.session_state.sample_data.get('followers', 1000))
                )
            with col_posts:
                posts_count = st.number_input(
                    "Posts Count",
                    min_value=0,
                    value=int(st.session_state.sample_data.get('posts_count', 100))
                )
            
            col_private, col_verified = st.columns(2)
            with col_private:
                is_private = st.checkbox(
                    "Private Account",
                    value=st.session_state.sample_data.get('is_private', False)
                )
            with col_verified:
                is_verified = st.checkbox(
                    "Verified Account",
                    value=st.session_state.sample_data.get('is_verified', False)
                )
            
            # Persona Info
            st.subheader("Persona Information")
            col_persona, col_confidence = st.columns(2)
            with col_persona:
                persona_label = st.text_input(
                    "Persona Label",
                    value=st.session_state.sample_data.get('persona_label', 'Demo')
                )
            with col_confidence:
                persona_confidence = st.slider(
                    "Persona Confidence",
                    min_value=0.0,
                    max_value=1.0,
                    value=st.session_state.sample_data.get('persona_confidence', 0.8),
                    step=0.1,
                    help="Confidence level of persona classification"
                )
            
            # Style Preferences
            st.subheader("Style Preferences")
            style_palette = st.text_input(
                "Style Palette",
                value=st.session_state.sample_data.get('style_palette', 'minimalist,bold'),
                help="Comma-separated values"
            )
            archetypes = st.text_input(
                "Archetypes",
                value=st.session_state.sample_data.get('archetypes', 'LuxuryClassic'),
                help="Comma-separated values"
            )
            color_palette = st.text_input(
                "Color Palette",
                value=st.session_state.sample_data.get('color_palette', '#1E90FF,#8B4513,#C0C0C0'),
                help="Comma-separated hex colors"
            )
            
            # Demographics
            st.subheader("Demographics")
            col_age, col_gender = st.columns(2)
            with col_age:
                age_range = st.selectbox(
                    "Age Range",
                    ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
                    index=1,
                    key="age_range_select"
                )
            with col_gender:
                gender = st.selectbox(
                    "Gender",
                    ["male", "female", "unisex", "non-binary"],
                    index=2,
                    key="gender_select"
                )
            
            col_peak_hours, col_price = st.columns(2)
            with col_peak_hours:
                peak_hours = st.text_input(
                    "Peak Hours",
                    value=st.session_state.sample_data.get('peak_hours', '9-17'),
                    help="e.g., 9-17, 18-22"
                )
            with col_price:
                price_tier = st.selectbox(
                    "Price Tier",
                    ["budget", "mid", "premium", "luxury"],
                    key="price_tier_demographics"
                )
            
            # Content Preferences
            st.subheader("Content Preferences")
            preferred_category = st.selectbox(
                "Preferred Category",
                ["fashion", "lifestyle", "beauty", "travel", "food", "tech"],
                index=0,
                key="preferred_category_select"
            )
            
            copy_tone = st.selectbox(
                "Copy Tone",
                ["friendly", "luxury", "minimal", "bold", "casual", "professional"],
                index=0,
                key="copy_tone_select"
            )
            
            
            # Submit button
            submitted = st.form_submit_button("🎨 Generate Creative", type="primary")
            
            # Auto-generate if random creative was requested
            if st.session_state.get('auto_generate', False):
                submitted = True
                st.session_state.auto_generate = False  # Reset the flag
            
            # Handle form submission INSIDE the form context
            if submitted:
                # Validate required fields
                if not email or not display_name:
                    st.error("Please fill in the required fields: Email and Display Name")
                else:
                    # Prepare data in the format expected by the local server
                    # Split semicolon-separated strings into arrays
                    def split_string(str_val):
                        if not str_val or isinstance(str_val, (int, float)):
                            return []
                        return [s.strip() for s in str(str_val).split(',') if s.strip()]
                    
                    # Build profile object
                    profile = {
                        "contact_id": st.session_state.sample_data.get('id', f"FASH-{int(time.time())}"),
                        "email": email,
                        "firstname": display_name.split(' ')[0] if display_name else 'Demo',
                        "lastname": ' '.join(display_name.split(' ')[1:]) if display_name and ' ' in display_name else '',
                        "locale": st.session_state.sample_data.get('language', 'en-US'),
                        "country": country,
                        "city": city,
                        "tags": split_string(style_palette),
                        "interest_keywords": split_string(archetypes),
                        "age_range": age_range,
                        "gender": gender,
                        "budget_range": price_tier,
                        "persona_label": persona_label,
                        "persona_confidence": persona_confidence,
                        "followers": followers,
                        "following": st.session_state.sample_data.get('following', 0),
                        "posts_count": posts_count,
                        "is_private": is_private,
                        "is_verified": is_verified,
                        "preferred_category": preferred_category,
                        "peak_hours": peak_hours,
                        "copy_tone": copy_tone
                    }
                    
                    # Build product object
                    product = {
                        "sku": f"SKU-{st.session_state.sample_data.get('id', 'DEMO')}",
                        "title": f"Premium Fashion Item for {persona_label}",
                        "category": "hoodies",
                        "colorways": split_string(color_palette),
                        "price_band": price_tier,
                        "launch_type": "drop",
                        "brand_name": "Demo Brand",
                        "season": "all-season",
                        "material": "cotton"
                    }
                    
                    # Build options object
                    options = {
                        "aspect": "1:1",
                        "channel": "instagram_feed",
                        "fallback_image_url": "https://dummyimage.com/1080x1080/111827/f5f5f5.png&text=Backup",
                        "ab_variant": "A",
                        "style_preference": "modern",
                        "mood": "confident",
                        "target_audience": "fashion_enthusiasts"
                    }
                    
                    # Final data structure expected by the server
                    data = {
                        "profile": profile,
                        "product": product,
                        "options": options,
                        "metadata": {
                            "source": "streamlit_frontend",
                            "timestamp": datetime.now().isoformat(),
                            "version": "2.0",
                            "persona_json": st.session_state.sample_data.get('persona_json', '{}')
                        }
                    }
                    
                    # Show loading
                    with st.spinner("🎨 Generating your fashion creative..."):
                        # Debug: Show data being sent (collapsible)
                        with st.expander("🔍 Debug: Data being sent to API"):
                            st.json(data)
                        
                        # Call API
                        result, status_code = call_local_server(data)
                    
                    # Debug: Show what we received
                    st.write("🔍 **DEBUG - API Response:**")
                    st.write(f"- Status Code: {status_code}")
                    st.write(f"- Success: {result.get('success')}")
                    st.write(f"- Status: {result.get('status')}")
                    st.write(f"- Has Request ID: {bool(result.get('creative', {}).get('request_id'))}")
                    if result.get('creative', {}).get('request_id'):
                        st.write(f"- Request ID: {result['creative']['request_id']}")
                    
                    # Debug: Show full response if there's an error
                    if status_code != 200:
                        st.write("🔍 **DEBUG - Full Error Response:**")
                        st.write(f"Raw response: {result}")
                        st.write(f"Response type: {type(result)}")
                        if isinstance(result, dict):
                            st.write(f"Response keys: {list(result.keys())}")
                            if 'error' in result:
                                st.write(f"Error message: {result['error']}")
                    
                    # Check if we need to poll for image
                    if (status_code == 200 and result.get('success', True) and 
                        result.get('status') == 'image_polling' and 
                        result.get('creative', {}).get('request_id')):
                        
                        request_id = result['creative']['request_id']
                        st.info(f"🔄 Image generation started! Polling for result... (Request ID: {request_id})")
                        
                        # Poll for the final image
                        with st.spinner("⏳ Waiting for image generation to complete..."):
                            max_polls = 20  # 20 polls max (10 seconds)
                            poll_count = 0
                            
                            # Debug: Show polling progress
                            progress_bar = st.progress(0)
                            status_text = st.empty()
                            
                            while poll_count < max_polls:
                                poll_result = poll_for_image(request_id)
                                poll_count += 1
                                
                                # Debug: Show polling result
                                st.write(f"🔍 **Poll {poll_count}:** Status = {poll_result.get('status', 'Unknown')}, Error = {poll_result.get('error', 'None')}")
                                
                                # Update progress
                                progress = min(poll_count / max_polls, 1.0)
                                progress_bar.progress(progress)
                                status_text.text(f"Polling attempt {poll_count}/{max_polls} - Status: {poll_result.get('status', 'Unknown')}")
                                
                                if poll_result.get('status') == 'Ready':
                                    # Update the result with the final image
                                    if poll_result.get('result', {}).get('sample'):
                                        result['creative']['image_url'] = poll_result['result']['sample']
                                        result['status'] = 'image_generated'
                                        progress_bar.progress(1.0)
                                        status_text.text("✅ Image generation completed!")
                                        st.success("✅ AI image generated successfully!")
                                        st.write(f"🔍 **Final Image URL:** {poll_result['result']['sample'][:50]}...")
                                    break
                                elif poll_result.get('status') in ['Error', 'Failed']:
                                    st.warning(f"⚠️ Image generation failed: {poll_result.get('error', 'Unknown error')}")
                                    break
                                else:
                                    # Still processing, wait a bit
                                    time.sleep(0.5)
                            
                            if poll_count >= max_polls:
                                st.warning("⏰ Image generation is taking longer than expected. Using fallback image.")
                                progress_bar.empty()
                                status_text.empty()
                    
                    # Display results
                    if status_code == 200 and result.get('success', True):
                        if result.get('status') == 'image_generated':
                            st.markdown('<div class="success-message">✅ Creative generated successfully with AI image!</div>', unsafe_allow_html=True)
                        else:
                            st.markdown('<div class="success-message">✅ Creative generated successfully!</div>', unsafe_allow_html=True)
                    elif status_code == 500 and 'Image generation failed' in str(result.get('error', '')):
                        st.markdown('<div class="error-message">⚠️ Creative generated with fallback image (Image service unavailable)</div>', unsafe_allow_html=True)
                    else:
                        st.markdown('<div class="error-message">❌ Error generating creative. Using demo data.</div>', unsafe_allow_html=True)
                    
                    # Store result in session state for display in right column
                    st.session_state.last_result = result
                    st.session_state.last_status_code = status_code
    
    with col2:
        st.header("🎨 Generated Creative")
        
        # Display the creative content from session state
        if st.session_state.get('last_result'):
            result = st.session_state.last_result
            status_code = st.session_state.get('last_status_code', 200)
            
            # Display results
            if status_code == 200 and result.get('success', True):
                if result.get('status') == 'image_generated':
                    st.markdown('<div class="success-message">✅ Creative generated successfully with AI image!</div>', unsafe_allow_html=True)
                else:
                    st.markdown('<div class="success-message">✅ Creative generated successfully!</div>', unsafe_allow_html=True)
            elif status_code == 500 and 'Image generation failed' in str(result.get('error', '')):
                st.markdown('<div class="error-message">⚠️ Creative generated with fallback image (Image service unavailable)</div>', unsafe_allow_html=True)
            else:
                st.markdown('<div class="error-message">❌ Error generating creative. Using demo data.</div>', unsafe_allow_html=True)
            
            # Display the creative content
            if result.get('creative'):
                creative = result['creative']
                
                # Image - Display prominently at the top
                if creative.get('image_url'):
                    st.image(creative['image_url'], caption="Generated Creative", use_column_width=True)
                
                # Copy
                if creative.get('copy', {}).get('subject') or creative.get('copy', {}).get('body'):
                    st.subheader("📝 Generated Copy")
                    if creative['copy'].get('subject'):
                        st.write(f"**Subject:** {creative['copy']['subject']}")
                    if creative['copy'].get('body'):
                        st.write(f"**Body:** {creative['copy']['body']}")
                
                # Persona
                if creative.get('persona'):
                    st.subheader("👤 Persona")
                    st.write(f"**Type:** {creative['persona']}")
                    if creative.get('color_palette'):
                        st.write(f"**Color Palette:** {', '.join(creative['color_palette'])}")
                
                # BFL Prompt (for debugging)
                if creative.get('bfl_prompt'):
                    with st.expander("🔍 BFL Prompt Used"):
                        st.text(creative['bfl_prompt'])
        else:
            st.info("👈 Fill out the form and click 'Generate Creative' to see results here")
    
    # Footer
    st.markdown("---")
    st.markdown(
        """
        <div style="text-align: center; color: #666; font-size: 0.8em;">
            <p>🎨 Fashion Creative Generator | Powered by AI | Generated on {}</p>
        </div>
        """.format(datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        unsafe_allow_html=True
    )

if __name__ == "__main__":
    main()
