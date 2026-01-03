export default async function ChatView() {
    return `<div class="chatarea">
                <div class= "usersList">
                    <ul>
                        <li class="userContact">
                            <span class="contactUsername">@Mo</span>
                            <span class ="contactStatus online">Online</span>
                        </li>
                    </ul>

                </div>
                <div class= "chatspace">
                    <div class ="usercard">
                        <p>Mohamed - active</p>
                        
                    </div>
                    <!-- scrollable -->
                    <div class ="chatsection">
                        <h3 class="from">yo broski</h3>
                        <h3 class="to">How are you man</h3>
                    </div>
                    <div class ="inputbar">
                        <textarea class="entry"></textarea>
                        <button id="sendBtn">Send</button>
                    </div>
                </div>
            </div>`
}