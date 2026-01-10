export default async function CreateView() {
    return `<main class="makepost-card-horizontal">
        <div class="makepost-header">
            <h1 class="post-title">Create a Post</h1>
            <p class="post-subtitle">Share your thoughts with the community.</p>
        </div>

        <form class="form-horizontal" data-form="create">
            <div class="makepost-form-row">
                <!-- Left column -->
                <div class="makepost-form-left">
                    <div class="post-title">
                        <label for="title-input" class="label">Title</label>
                        <input class="input" type="text" id="title-input" name="title" placeholder="Write your title..."
                            minlength="3" maxlength="100" required />
                    </div>

                    <fieldset class="post-categories" aria-describedby="category-help">
                        <legend class="label">Choose Categories</legend>

                        <select id="category-select" name="categories" class="input multi-select" multiple required
                            aria-describedby="category-help">
                            <option value="General">General</option>
                            <option value="Technology">Technology</option>
                            <option value="Sports">Sports</option>
                            <option value="Music">Music</option>
                            <option value="Gaming">Gaming</option> 
                        </select>

                        <small class="help-text" id="category-help">
                            Click on Ctrl/⌘ to multi-select or to Undo selection.
                        </small>
                    </fieldset>
                </div>

                <!-- Right column -->
                <div class="makepost-form-right">
                    <div class="post-content">
                        <label for="content-input" class="label">Content</label>
                        <textarea class="input" id="content-input" name="content"
                            placeholder="Write your post content here..." minlength="10" maxlength="3000"
                            required></textarea>
                    </div>
                </div>
            </div>

            <div class="makepost-form-bottom">
                <button class="btn btn-primary" type="submit" >Post</button>
            </div>
        </form>
    </main>`
}